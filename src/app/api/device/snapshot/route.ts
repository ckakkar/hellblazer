import { handleWatch } from "@/lib/watch/server";
import { buildWidgetSnapshot } from "@/lib/widget-snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The widget snapshot for the iPhone app to fetch on its own, when a silent
 * push says a workout was finished (ios/App/App/WidgetRefresher.swift).
 * Authenticated by the phone's device token, like the watch's API; unit and
 * timezone come in the same X-Fatty-* headers.
 */
export async function GET(request: Request) {
  return handleWatch(request, async (ctx) => ({
    ...(await buildWidgetSnapshot(ctx.db, ctx)),
    updatedAt: Date.now(),
  }));
}
