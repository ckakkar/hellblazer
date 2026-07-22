"use server";

import { getAuthedContext } from "@/lib/auth";
import { getTrainingProfile } from "@/lib/data/evaluation";
import { TIERS, TIER_KEYS, getTier } from "@/lib/tiers";

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

  const ladder = TIERS.map(
    (t) => `${t.rank}. ${t.name} (key: "${t.key}") — ${t.blurb}`,
  ).join("\n");

  const system = `You are the judge of strength in a Baki-themed training app. Place the lifter into exactly ONE tier of this 9-rank ladder (weakest to strongest):
${ladder}

Judge holistically from their data: estimated 1RMs, strength relative to bodyweight, total training volume, consistency and frequency, training age, and rate of progression. Be honest and a little brutal. Most real lifters sit around Doppo–Hanayama; only elite, long-tenured, exceptionally strong lifters approach Pickle/Baki/Yujiro. Lifters with little history or light numbers belong near the bottom.

Respond with ONLY a JSON object of exactly this shape:
{"tier":"<one of the exact keys above>","rationale":"<2-3 sentences, Baki-flavored but grounded in their real numbers>","highlights":["<short data point>","<short data point>","<short data point>"]}`;

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
        model: "deepseek-chat",
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
      return {
        ok: false,
        error: "failed",
        message: `The judge is unreachable (${res.status}). Try again.`,
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
      tierKey = byName?.key ?? "doppo";
    }
    const tier = getTier(tierKey)!;

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
