#!/usr/bin/env node
/**
 * One-time setup so GitHub Actions can sign and upload iOS builds, without
 * Xcode on this machine. Run it once after creating an App Store Connect API
 * key (Admin role):
 *
 *   node scripts/ios-signing-setup.mjs --key ~/Downloads/AuthKey_ABC123XYZ.p8 --issuer <issuer-id>
 *
 * It then:
 *   1. registers the bundle IDs of the app, its widget extension, its Apple
 *      Watch app and the watch's complications, and turns on their
 *      capabilities (Sign in with Apple, Push, HealthKit, App Groups,
 *      Associated Domains),
 *   2. creates an Apple Distribution certificate from a fresh private key,
 *   3. stores the key, certificate and API key as GitHub Actions secrets,
 *   4. sets the IOS_TEAM_ID and IOS_CERT_ID variables. TestFlight uploads
 *      then start once IOS_TESTFLIGHT is set to "on" (after the App Group
 *      and the App Store Connect app record exist); until then
 *      .github/workflows/ios.yml runs compile checks.
 *
 * Secrets go straight from here to GitHub (via the gh CLI) and are never
 * printed. The private key only exists in a temp folder that's deleted at
 * the end. Re-running skips the certificate if the secret already exists;
 * pass --new-cert to replace it (revoke the old one in the developer portal,
 * as Apple allows only a few).
 */
import { execFileSync } from "node:child_process";
import { createPrivateKey, randomBytes, sign } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";
import { parseArgs } from "node:util";

const BUNDLE_ID = "com.kkrwhofrags.hellblazer";
const WIDGETS_ID = `${BUNDLE_ID}.widgets`;
const WATCH_ID = `${BUNDLE_ID}.watchkitapp`;
const WATCH_WIDGETS_ID = `${WATCH_ID}.widgets`;
const APP_NAME = "Fatty";
const API = "https://api.appstoreconnect.apple.com/v1";

const { values: args } = parseArgs({
  options: {
    key: { type: "string" },
    "key-id": { type: "string" },
    issuer: { type: "string" },
    "new-cert": { type: "boolean", default: false },
  },
});

function die(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

if (!args.key || !args.issuer) {
  die("Usage: node scripts/ios-signing-setup.mjs --key <path to AuthKey_XXXX.p8> --issuer <issuer id>");
}
const keyPath = args.key.replace(/^~(?=\/)/, homedir());
const keyId = args["key-id"] ?? basename(keyPath).match(/^AuthKey_([A-Z0-9]+)\.p8$/)?.[1];
if (!keyId) die("Couldn't read the key ID from the file name. Pass it with --key-id.");
const p8 = readFileSync(keyPath, "utf8");

/** App Store Connect API token: ES256 JWT, valid for 20 minutes. */
function token() {
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "ES256", kid: keyId, typ: "JWT" });
  const body = b64({ iss: args.issuer, iat: now, exp: now + 1200, aud: "appstoreconnect-v1" });
  const sig = sign("sha256", Buffer.from(`${head}.${body}`), {
    key: createPrivateKey(p8),
    dsaEncoding: "ieee-p1363",
  }).toString("base64url");
  return `${head}.${body}.${sig}`;
}

async function asc(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token()}`, "content-type": "application/json" },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = json.errors?.map((e) => e.detail ?? e.title).join("; ") ?? res.statusText;
    die(`App Store Connect API ${res.status} on ${path}: ${detail}`);
  }
  return json;
}

function gh(argv, input) {
  return execFileSync("gh", argv, { input, encoding: "utf8", stdio: ["pipe", "pipe", "inherit"] });
}

// 0. Preconditions: gh is signed in and points at this repo.
let repo;
try {
  repo = gh(["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]).trim();
} catch {
  die("The GitHub CLI isn't signed in here. Run: gh auth login");
}
console.log(`Repo: ${repo}`);

// 1. Bundle ID.
/** The bundle ID's portal record, registering it first if needed. */
async function ensureBundleId(identifier, name) {
  const found = await asc(`/bundleIds?filter[identifier]=${identifier}&limit=200`);
  const existing = found.data.find((b) => b.attributes.identifier === identifier);
  if (existing) {
    console.log(`✓ Bundle ID ${identifier} already registered`);
    return existing.id;
  }
  const created = await asc("/bundleIds", {
    method: "POST",
    body: JSON.stringify({
      data: { type: "bundleIds", attributes: { identifier, name, platform: "IOS" } },
    }),
  });
  console.log(`✓ Registered bundle ID ${identifier}`);
  return created.data.id;
}

/** Turns on capabilities the ID doesn't have yet. */
async function ensureCapabilities(bundleRecordId, identifier, capabilities) {
  const current = await asc(`/bundleIds/${bundleRecordId}/bundleIdCapabilities`);
  const have = new Set(current.data.map((c) => c.attributes.capabilityType));
  for (const { type, settings } of capabilities) {
    if (have.has(type)) continue;
    await asc("/bundleIdCapabilities", {
      method: "POST",
      body: JSON.stringify({
        data: {
          type: "bundleIdCapabilities",
          attributes: { capabilityType: type, ...(settings ? { settings } : {}) },
          relationships: { bundleId: { data: { type: "bundleIds", id: bundleRecordId } } },
        },
      }),
    });
  }
  console.log(`✓ ${identifier}: ${capabilities.map((c) => c.type).join(", ")}`);
}

// The app and its widget extension (Home Screen widget + rest timer Live
// Activity). App Groups still need the group itself attached in the portal:
// Apple has no API for that step.
const appRecord = await ensureBundleId(BUNDLE_ID, APP_NAME);
const widgetsRecord = await ensureBundleId(WIDGETS_ID, `${APP_NAME} Widgets`);
const watchRecord = await ensureBundleId(WATCH_ID, `${APP_NAME} Watch`);
// The watch face complications need no capabilities: they share data with
// the watch app through the team's keychain group, which every profile allows.
await ensureBundleId(WATCH_WIDGETS_ID, `${APP_NAME} Watch Complications`);
await ensureCapabilities(appRecord, BUNDLE_ID, [
  {
    type: "APPLE_ID_AUTH",
    settings: [{ key: "APPLE_ID_AUTH_APP_CONSENT", options: [{ key: "PRIMARY_APP_CONSENT" }] }],
  },
  { type: "PUSH_NOTIFICATIONS" },
  { type: "HEALTHKIT" },
  { type: "APP_GROUPS" },
  { type: "ASSOCIATED_DOMAINS" },
]);
await ensureCapabilities(widgetsRecord, WIDGETS_ID, [{ type: "APP_GROUPS" }]);
// The watch records workouts to Apple Health.
await ensureCapabilities(watchRecord, WATCH_ID, [{ type: "HEALTHKIT" }]);

// 2 + 3. Distribution certificate, stored as a password-protected .p12.
const existing = JSON.parse(gh(["secret", "list", "--json", "name"])).map((s) => s.name);
let teamId;
let certId;
if (existing.includes("IOS_DIST_CERT_P12") && !args["new-cert"]) {
  console.log("✓ Distribution certificate secret already exists (pass --new-cert to replace it)");
  const vars = JSON.parse(gh(["variable", "list", "--json", "name,value"]));
  teamId = vars.find((v) => v.name === "IOS_TEAM_ID")?.value;
  certId = vars.find((v) => v.name === "IOS_CERT_ID")?.value;
  if (!teamId || !certId) die("IOS_TEAM_ID / IOS_CERT_ID variables are missing. Re-run with --new-cert.");
} else {
  const dir = mkdtempSync(join(tmpdir(), "hb-signing-"));
  try {
    const f = (name) => join(dir, name);
    const openssl = (...argv) => execFileSync("openssl", argv, { cwd: dir, stdio: ["ignore", "pipe", "pipe"] });

    openssl("genrsa", "-out", f("key.pem"), "2048");
    openssl("req", "-new", "-key", f("key.pem"), "-subj", `/CN=${APP_NAME} CI`, "-out", f("csr.pem"));
    const created = await asc("/certificates", {
      method: "POST",
      body: JSON.stringify({
        data: {
          type: "certificates",
          attributes: { certificateType: "DISTRIBUTION", csrContent: readFileSync(f("csr.pem"), "utf8") },
        },
      }),
    });
    certId = created.data.id;
    writeFileSync(f("cert.der"), Buffer.from(created.data.attributes.certificateContent, "base64"));
    openssl("x509", "-inform", "DER", "-in", f("cert.der"), "-out", f("cert.pem"));

    // The team ID is the certificate subject's OU.
    const subject = openssl("x509", "-in", f("cert.pem"), "-noout", "-subject", "-nameopt", "multiline").toString();
    teamId = subject.match(/organizationalUnitName\s*=\s*([A-Z0-9]{10})/)?.[1];
    if (!teamId) die("Couldn't read the team ID from the new certificate.");

    // 3DES/SHA1 encryption: the format macOS `security import` reliably accepts.
    const password = randomBytes(24).toString("hex");
    execFileSync(
      "openssl",
      [
        "pkcs12", "-export",
        "-inkey", f("key.pem"), "-in", f("cert.pem"), "-out", f("cert.p12"),
        "-name", `${APP_NAME} Distribution`,
        "-certpbe", "PBE-SHA1-3DES", "-keypbe", "PBE-SHA1-3DES", "-macalg", "sha1",
        "-passout", "env:HB_P12_PASSWORD",
      ],
      { cwd: dir, env: { ...process.env, HB_P12_PASSWORD: password }, stdio: ["ignore", "pipe", "pipe"] },
    );

    gh(["secret", "set", "IOS_DIST_CERT_P12"], readFileSync(f("cert.p12")).toString("base64"));
    gh(["secret", "set", "IOS_DIST_CERT_PASSWORD"], password);
    console.log(`✓ Created Apple Distribution certificate ${certId} and stored it as a secret`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// 3. API key, for fetching profiles and uploading to TestFlight.
gh(["secret", "set", "ASC_KEY_ID"], keyId);
gh(["secret", "set", "ASC_ISSUER_ID"], args.issuer);
gh(["secret", "set", "ASC_KEY_P8"], p8);
console.log("✓ Stored the App Store Connect API key as secrets");

// 4. Variables last: IOS_TEAM_ID is what switches CI to TestFlight uploads.
gh(["variable", "set", "IOS_CERT_ID", "--body", certId]);
gh(["variable", "set", "IOS_TEAM_ID", "--body", teamId]);
console.log(`✓ Set IOS_TEAM_ID (${teamId}) and IOS_CERT_ID`);

console.log(`
Done. Next:
  • Developer portal → Identifiers → + → App Groups: group.${BUNDLE_ID}, then attach
    it to ${BUNDLE_ID} and ${WIDGETS_ID} (App Groups → Configure).
  • App Store Connect → Apps → + → New App: pick bundle ID ${BUNDLE_ID}, name "${APP_NAME}".
  • Then switch uploads on and run the iOS workflow:
    gh variable set IOS_TESTFLIGHT --body on && gh workflow run ios.yml`);
