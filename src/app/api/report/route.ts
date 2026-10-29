import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Where the app says something went wrong, so a run of failures after a
 * release shows up in the server's logs (one JSON line each, "hb-report")
 * instead of only on lifters' screens. Only what failed and where: a kind
 * from a fixed list, the page's route with its ids masked, the app's
 * version. Never who, never workout content, names or Health readings
 * (src/lib/report.ts sends them; the privacy page says so). The browser's
 * Content-Security-Policy violation reports land here too.
 */
const KINDS = [
  "action-failed",
  "set-save-failed",
  "finish-failed",
  "outbox-dropped",
  "outbox-stuck",
  "render-error",
] as const;

const reportSchema = z.object({
  kind: z.enum(KINDS),
  route: z.string().max(120),
  /** A short code: the action's name ("start the workout"), an error class. */
  code: z.string().max(80).optional(),
  version: z.string().max(20).optional(),
});

/** Ids out of a path: /log/3f2… becomes /log/:id. */
const mask = (path: string) => path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ":id").slice(0, 120);

export async function POST(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  const text = (await request.text().catch(() => "")).slice(0, 8000);
  try {
    if (type.includes("csp-report") || type.includes("reports+json")) {
      const body = JSON.parse(text);
      const r = Array.isArray(body) ? body[0]?.body : body["csp-report"];
      if (r) {
        console.warn(
          JSON.stringify({
            hb: "report",
            kind: "csp",
            directive: String(r["violated-directive"] ?? r.effectiveDirective ?? "").slice(0, 60),
            blocked: String(r["blocked-uri"] ?? r.blockedURL ?? "").replace(/\?.*$/, "").slice(0, 120),
            route: mask(new URL(String(r["document-uri"] ?? r.documentURL ?? "/"), "https://x").pathname),
          }),
        );
      }
      return new NextResponse(null, { status: 204 });
    }
    const v = reportSchema.parse(JSON.parse(text));
    console.warn(JSON.stringify({ hb: "report", ...v, route: mask(v.route) }));
  } catch {
    // A malformed report is dropped; there's nothing to tell the sender.
  }
  return new NextResponse(null, { status: 204 });
}
