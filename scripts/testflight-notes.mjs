#!/usr/bin/env node
/**
 * Sets a TestFlight build's "What to Test" text, after fastlane has uploaded
 * it. Run by .github/workflows/ios.yml; fastlane's own changelog option still
 * writes the retired `whatToTest` attribute, which the API now rejects, so it
 * reports success and nothing appears. The field is `whatsNew` now.
 *
 * Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8 (the .p8's text), BUILD_NUMBER,
 * TESTFLIGHT_NOTES. Waits (up to 20 minutes) for Apple to list the build.
 */
import { createPrivateKey, sign } from "node:crypto";

const BUNDLE_ID = "com.kkrwhofrags.hellblazer";
const API = "https://api.appstoreconnect.apple.com/v1";
const env = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set`);
  return value;
};
const notes = env("TESTFLIGHT_NOTES").slice(0, 4000);
const buildNumber = env("BUILD_NUMBER");

function token() {
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "ES256", kid: env("ASC_KEY_ID"), typ: "JWT" });
  const body = b64({ iss: env("ASC_ISSUER_ID"), iat: now, exp: now + 1200, aud: "appstoreconnect-v1" });
  const sig = sign("sha256", Buffer.from(`${head}.${body}`), {
    key: createPrivateKey(env("ASC_KEY_P8")),
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
    throw new Error(`App Store Connect ${res.status} on ${path}: ${detail}`);
  }
  return json;
}

const apps = await asc(`/apps?filter[bundleId]=${BUNDLE_ID}`);
const appId = apps.data[0]?.id;
if (!appId) throw new Error(`No App Store Connect app for ${BUNDLE_ID}`);

let build;
for (let tries = 0; tries < 40 && !build; tries++) {
  const found = await asc(`/builds?filter[app]=${appId}&filter[version]=${buildNumber}&limit=1`);
  build = found.data[0];
  if (!build) await new Promise((r) => setTimeout(r, 30_000));
}
if (!build) throw new Error(`Build ${buildNumber} never appeared in App Store Connect`);

const existing = await asc(`/builds/${build.id}/betaBuildLocalizations`);
const loc = existing.data.find((l) => l.attributes.locale === "en-US");
if (loc) {
  await asc(`/betaBuildLocalizations/${loc.id}`, {
    method: "PATCH",
    body: JSON.stringify({ data: { type: "betaBuildLocalizations", id: loc.id, attributes: { whatsNew: notes } } }),
  });
} else {
  await asc("/betaBuildLocalizations", {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "betaBuildLocalizations",
        attributes: { locale: "en-US", whatsNew: notes },
        relationships: { build: { data: { type: "builds", id: build.id } } },
      },
    }),
  });
}
console.log(`✓ What to Test set on build ${buildNumber}`);
