"use server";

import { getAuthedContext } from "@/lib/auth";
import { getTrainingProfile } from "@/lib/data/evaluation";
import { getProfile } from "@/lib/data/profile";
import { TIERS, TIER_KEYS, MAX_RANK, getTier } from "@/lib/tiers";

export type EvalResult =
  | {
      ok: true;
      tierKey: string;
      tierName: string;
      rank: number;
      rationale: string;
      highlights: string[];
    }
  | {
      ok: false;
      error: "not_configured" | "no_data" | "failed";
      message: string;
    };

/**
 * Manually-triggered strength evaluation. Sends the user's full training
 * snapshot to DeepSeek and returns a proposed tier for the user to accept or
 * reject. Never persists — accepting is a separate action, so re-running is
 * the only cost (kept manual to avoid needless token spend).
 */
export async function evaluateTier(): Promise<EvalResult> {
  await getAuthedContext(); // require auth; RLS scopes the compiled data

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "not_configured",
      message:
        "DeepSeek isn't connected yet. Add a DEEPSEEK_API_KEY to enable evaluations.",
    };
  }

  const profile = await getTrainingProfile();
  if (profile.totalSessions === 0) {
    return {
      ok: false,
      error: "no_data",
      message: "No logged sessions yet — earn your judgment in the arena first.",
    };
  }

  // Rank ratchet: a lifter can only hold or climb, never fall. The current
  // tier is the floor — passed to the model as a hard constraint, and enforced
  // server-side below in case the model ignores it.
  const currentProfile = await getProfile();
  const currentTier = getTier(currentProfile?.tier);
  const floorNote = currentTier
    ? `\n\nRANK FLOOR (STRICT): This lifter already holds rank ${currentTier.rank} — ${currentTier.name}. Strength earned is never lost here. You MUST place them at rank ${currentTier.rank} or HIGHER; never below, under any circumstances. If today's numbers only support their current rank, keep them there; if they've grown, promote them.`
    : "";

  const ladder = TIERS.map(
    (t) =>
      `${t.rank}. ${t.name} — "${t.epithet}" (key: "${t.key}") — ${t.blurb}`,
  ).join("\n");

  const system = `You are the judge of strength in a Kengan Ashura-themed training app. Place the lifter into exactly ONE tier of this ${MAX_RANK}-rank ladder (weakest to strongest):
${ladder}

Your job is to be FAIR and a little generous — a Kengan matchmaker who genuinely respects the work, not a gatekeeper. Actually think about how strong this person is and give them the rank they've earned. When a lifter sits between two tiers, round UP. Reward consistency, training age, and steady progression as much as raw numbers — someone who keeps showing up and adding weight is getting stronger and should climb. Never punish a short history if the logged work is solid; judge by demonstrated strength, not by how long they've used the app.

Calibrate to the lifter when their details are known: strength standards are sex-relative (a given absolute load is more impressive for a female or lighter/older lifter), so judge bodyweight-relative on the big compounds and weight the reference anchors below by sex, bodyweight, height and age. Never penalise anyone for their demographics — use them only to give fair, generous credit.

Use these GENEROUS reference anchors (a natural MALE lifter at the stated bodyweight-relative numbers; scale expectations down for female, lighter, or masters lifters, judged on their best working sets; use bodyweight-relative numbers on the big compounds — squat, bench, deadlift, overhead press, rows — whenever bodyweight is known, otherwise judge absolute loads and consistency and lean generous):
- Rei Mikazuchi (1): just getting started — first few weeks in the ring, still finding form and light loads.
- Setsuna Kiryu (2): a real beginner base — training regularly, loads clearly climbing (roughly bench ~0.6×bw, squat ~1×bw).
- Sen Hatsumi (3): solid intermediate — strong for a regular gym-goer (bench ~0.85×bw, squat ~1.25×bw, deadlift ~1.5×bw).
- Gaolang Wongsawat (4): strong intermediate — visibly above average with consistent volume (bench ~1×bw, squat ~1.5×bw, deadlift ~1.75×bw).
- Julius Reinhold (5): advanced — strong in any gym (bench ~1.25×bw, squat ~1.75×bw, deadlift ~2×bw).
- Raian Kure (6): very advanced — years of hard work and big numbers (bench ~1.4×bw, squat ~2×bw, deadlift ~2.25×bw).
- Wakatsuki Takeshi (7): near-elite — big, well-rounded strength approaching competitive numbers.
- Ohma Tokita (8): elite — near-competitive strength.
- Kanoh Agito (9): near the natural ceiling — exceptional across the board.
- Kuroki Gensai (10): once-in-a-generation, monstrous numbers — reserve for the truly freakish.

Be encouraging and grounded in their real numbers. It is fine — good, even — to place a committed lifter in the middle of the ladder; do not default everyone to the bottom.${floorNote}

Respond with ONLY a JSON object of exactly this shape:
{"tier":"<one of the exact keys above>","rationale":"<2-3 sentences, Kengan-flavored, honest but motivating and grounded in their real numbers>","highlights":["<short data point>","<short data point>","<short data point>"]}`;

  const userMsg = `Lifter's full training data (all weights in kg):\n${JSON.stringify(
    profile,
    null,
    2,
  )}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        // DeepSeek retired "deepseek-chat"; v4 models are the supported names.
        model: "deepseek-v4-pro",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMsg },
        ],
        temperature: 0.6,
        max_tokens: 700,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      // Surface DeepSeek's own reason — a raw status alone hides the cause
      // (bad key, empty balance, invalid param, rate limit, …).
      const raw = await res.text().catch(() => "");
      let reason = "";
      try {
        reason = (JSON.parse(raw)?.error?.message as string) ?? "";
      } catch {
        reason = raw.slice(0, 160);
      }
      console.error("DeepSeek evaluation failed", res.status, raw.slice(0, 500));
      const friendly =
        res.status === 401
          ? "the API key is being rejected"
          : res.status === 402
            ? "the DeepSeek account is out of balance"
            : res.status === 429
              ? "rate limited — wait a moment"
              : reason || "the request was rejected";
      return {
        ok: false,
        error: "failed",
        message: `The judge turned you away (${res.status}) — ${friendly}. Try again.`,
      };
    }

    const json = await res.json();
    const content: string | undefined = json?.choices?.[0]?.message?.content;
    if (!content) {
      return { ok: false, error: "failed", message: "No verdict returned." };
    }

    const parsed = JSON.parse(content) as {
      tier?: string;
      rationale?: string;
      highlights?: string[];
    };

    let tierKey = (parsed.tier ?? "").toLowerCase().trim();
    if (!TIER_KEYS.includes(tierKey)) {
      const byName = TIERS.find(
        (t) =>
          parsed.tier &&
          t.name.toLowerCase().includes(parsed.tier.toLowerCase().trim()),
      );
      tierKey = byName?.key ?? "hatsumi";
    }
    let tier = getTier(tierKey)!;

    // Enforce the ratchet regardless of what the model returned.
    if (currentTier && tier.rank < currentTier.rank) {
      tier = currentTier;
    }

    return {
      ok: true,
      tierKey: tier.key,
      tierName: tier.name,
      rank: tier.rank,
      rationale: parsed.rationale ?? "",
      highlights: Array.isArray(parsed.highlights)
        ? parsed.highlights.slice(0, 4).map(String)
        : [],
    };
  } catch {
    return {
      ok: false,
      error: "failed",
      message: "Evaluation failed — the judge turned away. Try again.",
    };
  }
}
