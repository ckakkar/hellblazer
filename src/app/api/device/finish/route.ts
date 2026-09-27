import { finishVoiceWorkout, handleWatch } from "@/lib/watch/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Finish my workout in Fatty" (ios/App/App/VoiceSetLogger.swift): finishes
 * the session in progress with the phone's device token. The phone then
 * ends the Live Activity and saves the workout to Apple Health.
 */
export async function POST(request: Request) {
  return handleWatch(request, finishVoiceWorkout, "phone");
}
