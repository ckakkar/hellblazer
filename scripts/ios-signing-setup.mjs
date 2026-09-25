#!/usr/bin/env node
/**
 * One-time setup so GitHub Actions can sign and upload iOS builds, without
 * Xcode on this machine. Run it once after creating an App Store Connect API
 * key (Admin role):
 *
 *   node scripts/ios-signing-setup.mjs --key ~/Downloads/AuthKey_ABC123XYZ.p8 --issuer <issuer-id>
 *
 * It then:
 *   1. registers the bundle ID com.kkrwhofrags.hellblazer (if it isn't already),
 *   2. creates an Apple Distribution certificate from a fresh private key,
 *   3. stores the key, certificate and API key as GitHub Actions secrets,
 *   4. sets the IOS_TEAM_ID and IOS_CERT_ID variables, which switches
 *      .github/workflows/ios.yml from compile checks to TestFlight uploads.
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
const found = await asc(`/bundleIds?filter[identifier]=${BUNDLE_ID}&limit=200`);
const bundle = found.data.find((b) => b.attributes.identifier === BUNDLE_ID);
if (bundle) {
  console.log(`✓ Bundle ID ${BUNDLE_ID} already registered`);
} else {
  await asc("/bundleIds", {
    method: "POST",
    body: JSON.stringify({
      data: { type: "bundleIds", attributes: { identifier: BUNDLE_ID, name: APP_NAME, platform: "IOS" } },
    }),
  });
  console.log(`✓ Registered bundle ID ${BUNDLE_ID}`);
}

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
  • App Store Connect → Apps → + → New App: pick bundle ID ${BUNDLE_ID}, name "${APP_NAME}".
  • Then run the iOS workflow (GitHub → Actions → iOS → Run workflow).`);
