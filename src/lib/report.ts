/**
 * Tells the server something failed (src/app/api/report): the kind, the
 * page's route and the app version, nothing about who or what was logged.
 * Fire-and-forget, at most once a minute per kind, and silent offline
 * (the failure is usually the connection; the screen already says so).
 */
export type ReportKind =
  | "action-failed"
  | "set-save-failed"
  | "finish-failed"
  | "outbox-dropped"
  | "outbox-stuck"
  | "render-error";

const last = new Map<string, number>();

export function reportProblem(kind: ReportKind, code?: string) {
  if (typeof window === "undefined" || !navigator.onLine) return;
  const now = Date.now();
  if (now - (last.get(kind) ?? 0) < 60_000) return;
  last.set(kind, now);
  const body = JSON.stringify({
    kind,
    route: window.location.pathname,
    code: code?.slice(0, 80),
    version: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7),
  });
  try {
    navigator.sendBeacon("/api/report", new Blob([body], { type: "application/json" }));
  } catch {
    // Nowhere to report the report failing.
  }
}
