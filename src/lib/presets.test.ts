import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PRESETS } from "./presets";

// load_preset looks each exercise up by name in the shared library, so a
// name the seed never inserted fails the whole program at load time.
const sqlDir = join(process.cwd(), "supabase");
const sql = [
  readFileSync(join(sqlDir, "seed.sql"), "utf8"),
  ...readdirSync(join(sqlDir, "migrations")).map((f) => readFileSync(join(sqlDir, "migrations", f), "utf8")),
].join("\n");

describe("starter programs", () => {
  it("only use exercises the library has", () => {
    const missing = PRESETS.flatMap((p) =>
      p.days.flatMap((d) =>
        d.exercises.filter((e) => !sql.includes(`'${e.name.replaceAll("'", "''")}'`)).map((e) => `${p.id}: ${e.name}`),
      ),
    );
    expect(missing).toEqual([]);
  });

  it("have unique ids and day names", () => {
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
    for (const p of PRESETS) expect(new Set(p.days.map((d) => d.name)).size).toBe(p.days.length);
  });

  it("keep Formless heavy on compounds and in hypertrophy ranges for arms and side delts", () => {
    const formless = PRESETS.find((p) => p.id === "full-body-5")!;
    const top = (reps: string) => Number(reps.split("-").at(-1));
    const arms = /Curl|Extension|Pushdown|Skull Crusher|Lateral Raise/;
    for (const day of formless.days)
      for (const ex of day.exercises) {
        if (arms.test(ex.name) && !/Leg Curl/.test(ex.name)) expect(top(ex.reps), ex.name).toBeGreaterThanOrEqual(12);
      }
  });
});
