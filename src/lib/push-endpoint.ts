/**
 * Whether a Web Push subscription's endpoint belongs to a real push service.
 * The browser hands us the URL and the server later POSTs to it, so an
 * endpoint anywhere else would let a signed-in user aim the server at an
 * address of their choosing (server-side request forgery). These are the
 * services the browsers that can subscribe actually use.
 */
const PUSH_HOSTS = [
  "fcm.googleapis.com", // Chrome, Android, Opera, Samsung Internet
  "android.googleapis.com", // older Chrome subscriptions
  "updates.push.services.mozilla.com", // Firefox
  "web.push.apple.com", // Safari, home-screen web apps on iOS
];
/** Edge (Windows Push Notification Services), e.g. wns2-par02p.notify.windows.com. */
const PUSH_HOST_SUFFIXES = [".notify.windows.com"];

export function isPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.port !== "" || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  return PUSH_HOSTS.includes(host) || PUSH_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}
