import { handleWatch, undoVoiceSet } from "@/lib/watch/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Undo my last set in Fatty" (ios/App/App/VoiceSetLogger.swift): takes back
 * the workout's most recent working set, with the phone's device token.
 */
export async function POST(request: Request) {
  return handleWatch(request, undoVoiceSet, "phone");
}
