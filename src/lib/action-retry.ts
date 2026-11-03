/**
 * Sends a server action's request once more when it died at once without
 * an answer. A phone's network drops a connection that sat idle for a while
 * (between sets, say) without telling it, and the next request on it fails
 * straight away. iOS re-sends a page or data request (a GET) on a fresh
 * connection by itself, but never a POST, and every server action is a
 * POST: so the first tap after a rest failed ("Couldn't start the workout")
 * while the error report sent a moment later went through.
 *
 * Only a request that failed within a few seconds, with a network error,
 * while the phone says it's online, and whose body can be sent again: one
 * that hung for long may have reached the server, and tapping again stays
 * the lifter's call. Nothing else that goes through fetch is touched.
 */

const RESEND_WINDOW_MS = 4_000;

function isAction(init: RequestInit | undefined): boolean {
  if (!init || (init.method ?? "GET").toUpperCase() !== "POST") return false;
  try {
    return new Headers(init.headers).has("next-action");
  } catch {
    return false;
  }
}

function canResend(body: BodyInit | null | undefined): boolean {
  return (
    body == null ||
    typeof body === "string" ||
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body)
  );
}

let installed = false;

export function resendDroppedActions() {
  if (installed || typeof window === "undefined" || typeof window.fetch !== "function") return;
  installed = true;
  const send = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const began = Date.now();
    try {
      return await send(input, init);
    } catch (err) {
      const dropped =
        err instanceof TypeError &&
        typeof input === "string" &&
        isAction(init) &&
        canResend(init?.body) &&
        !init?.signal?.aborted &&
        navigator.onLine &&
        Date.now() - began < RESEND_WINDOW_MS;
      if (!dropped) throw err;
      return send(input, init);
    }
  };
}
