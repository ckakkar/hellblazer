/**
 * The iOS app is a Capacitor shell that loads this same site in a WKWebView
 * (see capacitor.config.ts). Its native bridge defines `window.Capacitor`
 * before any page script runs, so this check is synchronous and safe to call
 * from event handlers.
 *
 * Everything app-only sits behind isNativeApp(), and plugin code is loaded
 * with a dynamic import inside that branch, so the website and PWA never
 * download or run it.
 */
type CapacitorGlobal = { isNativePlatform?: () => boolean };

export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  return cap?.isNativePlatform?.() === true;
}

/**
 * The iOS OAuth client ID from Google Cloud (Credentials, type iOS, bundle
 * com.kkrwhofrags.hellblazer). Public, not a secret. Its reversed form must also
 * be registered as a URL scheme in ios/App/App/Info.plist, or Google's SDK
 * crashes the app on sign-in, so the two always change together.
 */
export const GOOGLE_IOS_CLIENT_ID =
  "996397364248-4fqchnbekhet58kepnbe4dak6giqspdf.apps.googleusercontent.com";
