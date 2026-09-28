import { handleWatch, logVoiceSet } from "@/lib/watch/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A set logged from the iPhone without opening the page: "Same again" and
 * "Log a set" to Siri, the Action button, the Control Center button
 * (ios/App/App/VoiceSetLogger.swift). Authenticated by the phone's device
 * token; unit and timezone come in the X-Fatty-* headers.
 *
 *   POST {}                 the next set, same numbers as the last
 *   POST { weight, reps }   a set with these numbers (display unit)
 *   POST { weight, reps, sessionExerciseId }
 *                           the set the Lock Screen showed, on its exercise
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => ({}));
  return handleWatch(request, (ctx) => logVoiceSet(ctx, body), "phone");
}
