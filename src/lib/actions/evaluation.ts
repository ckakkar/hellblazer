"use server";

import { revalidatePath } from "next/cache";
import { getAuthedContext } from "@/lib/auth";
import { getEvalGate, getTrainingProfile } from "@/lib/data/evaluation";
import { EVAL_COOLDOWN_DAYS, daysUntil } from "@/lib/evaluation-rules";
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
      error: "not_configured" | "no_data" | "locked" | "failed";
      message: string;
    };

/**
 * Manually-triggered strength evaluation. Sends the user's full training
 * snapshot to DeepSeek and returns a proposed tier for the user to accept or
 * reject; the rank itself is only persisted by `setTier` on accept.
 *
 * Rate-limited by `getEvalGate`: you need a finished workout logged since your
 * last evaluation, and at most one evaluation every EVAL_COOLDOWN_DAYS days.
 * A delivered verdict stamps `profile.evaluation_run_at` whether or not it's
 * accepted, so declining can't buy a free re-roll.
 */
export async function evaluateTier(): Promise<EvalResult> {
  const { supabase, user } = await getAuthedContext(); // RLS scopes the data

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "not_configured",
      message:
        "DeepSeek isn't connected yet. Add a DEEPSEEK_API_KEY to enable evaluations.",
    };
  }

  // Authoritative gate. The UI disables the button too, but that's cosmetic —
  // this is what actually stops a replayed action from burning tokens.
  const gate = await getEvalGate();
  if (!gate.canRun) {
    if (gate.reason === "no_workout") {
      return {
        ok: false,
        error: "no_data",
        message:
          "No finished workouts yet — earn your judgment in the arena first.",
      };
    }
    if (gate.reason === "no_new_workout") {
      return {
        ok: false,
        error: "locked",
        message:
          "Nothing new to judge. Log a workout since your last evaluation, then step forward.",
      };
    }
    const days = gate.nextRunAt ? daysUntil(gate.nextRunAt) : EVAL_COOLDOWN_DAYS;
    return {
      ok: false,
      error: "locked",
      message: `The judge has already ruled. Return in ${days} ${
        days === 1 ? "day" : "days"
      }.`,
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

THE LADDER HAS TWO REGIMES. This is the most important rule and it overrides any general instinct toward evenness:

REGIME 1 — THE CLIMB (ranks 1-4, Rei → Gaolang): BRUTALLY HARD. This is the proving ground and it is meant to hurt. Demand real, demonstrated strength for every single step. Do NOT round up here — when a lifter sits between two of these tiers, place them in the LOWER one. Do not award a rank for enthusiasm, consistency, or potential; only logged loads earn it. Most lifters should spend a long time in this band, and a beginner belongs at Rei (1) until the numbers say otherwise. Reaching Gaolang (4) is a serious achievement that should feel earned.

REGIME 2 — THE ASCENT (ranks 5-10, Julius → Kuroki): VERY EASY. Once a lifter has cleared the Gaolang wall they have proven themselves, and the ladder rewards them. Promote FREELY and generously. Any clear progression since the last judgment — a heavier top set, added volume, steady consistency, a new PR on any lift — is enough to move up a rank. When between two of these tiers, always round UP, and where it's close, favour the higher rank. Do not gatekeep the top of the ladder and do not demand elite competition numbers; a lifter who is past Gaolang and still working should keep climbing toward Kuroki.

Calibrate to the lifter when their details are known: strength standards are sex-relative (a given absolute load is more impressive for a female or lighter/older lifter), so judge bodyweight-relative on the big compounds and weight the reference anchors below by sex, bodyweight, height and age. Never penalise anyone for their demographics — use them only to give fair credit.

Reference anchors (a natural MALE lifter at the stated bodyweight-relative numbers, judged on best working sets; scale expectations down for female, lighter, or masters lifters; use bodyweight-relative numbers on the big compounds — squat, bench, deadlift, overhead press, rows — whenever bodyweight is known, otherwise judge absolute loads):
- Rei Mikazuchi (1): the starting line. Everyone begins here and stays until they clearly out-lift it.
- Setsuna Kiryu (2): HARD — a genuine beginner base, training consistently for months (bench ~0.75×bw, squat ~1.2×bw, deadlift ~1.5×bw).
- Sen Hatsumi (3): HARD — a strong regular gym-goer, clearly above average (bench ~1×bw, squat ~1.5×bw, deadlift ~1.9×bw).
- Gaolang Wongsawat (4): HARDEST STEP — the wall. Serious, sustained strength (bench ~1.25×bw, squat ~1.85×bw, deadlift ~2.25×bw).
- Julius Reinhold (5): past the wall — only a modest step beyond Gaolang. Award readily.
- Raian Kure (6): any meaningful progression past Julius. Award readily.
- Wakatsuki Takeshi (7): continued progression and solid all-round work. Award readily.
- Ohma Tokita (8): sustained strength with consistent training. Award readily.
- Kanoh Agito (9): a long, committed record of hard training. Award readily.
- Kuroki Gensai (10): the summit — for a lifter well past the wall who keeps showing up and keeps adding weight. Reachable, not mythical.

Be honest and grounded in their real numbers. Below Gaolang, be a strict gatekeeper. Above Gaolang, be a champion of their progress.${floorNote}

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
        // v4 model names. Flash answers directly in `content`; pro is a
        // reasoning model that can spend the whole budget "thinking" and return
        // empty content. Give a generous ceiling either way.
        model: "deepseek-v4-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMsg },
        ],
        temperature: 0.6,
        max_tokens: 2000,
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
    const choice = json?.choices?.[0];
    // Reasoning models can leave `content` empty and put text in
    // `reasoning_content`; fall back to it before giving up.
    const content: string =
      choice?.message?.content || choice?.message?.reasoning_content || "";
    if (!content) {
      console.error(
        "DeepSeek returned no content",
        JSON.stringify(json).slice(0, 800),
      );
      const fr = choice?.finish_reason;
      return {
        ok: false,
        error: "failed",
        message: `No verdict returned${fr ? ` (${fr})` : ""}. Try again.`,
      };
    }

    // Pull the JSON object out even if it's wrapped in prose or code fences.
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content) as {
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

    // Start the cooldown. Stamped here — on a delivered verdict — rather than
    // on accept, so declining a verdict can't buy a free re-roll. Failures
    // above return early and cost the lifter nothing.
    await supabase
      .from("profile")
      .upsert({ user_id: user.id, evaluation_run_at: new Date().toISOString() });
    revalidatePath("/settings");

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
