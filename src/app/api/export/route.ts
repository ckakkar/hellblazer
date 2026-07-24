import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** RFC-4180 CSV cell: quote when it contains a comma, quote or newline. */
function cell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

type ExportRow = {
  set_number: number | null;
  weight_kg: number | null;
  reps: number | null;
  rpe: number | null;
  is_warmup: boolean | null;
  created_at: string;
  session_exercise: {
    exercise: { name: string | null; primary_muscle: string | null } | null;
    session: { date: string | null; title: string | null } | null;
  } | null;
};

/**
 * Streams the signed-in lifter's entire set log as a CSV download. The proxy
 * doesn't run on /api routes, so this authenticates on its own; RLS still
 * scopes every row to the caller. All weights are canonical kg.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data, error } = await supabase
    .from("set")
    .select(
      `set_number, weight_kg, reps, rpe, is_warmup, created_at,
       session_exercise:session_exercise_id (
         exercise:exercise_id ( name, primary_muscle ),
         session:session_id ( date, title )
       )`,
    )
    .order("created_at", { ascending: true });
  if (error) return new NextResponse("Export failed", { status: 500 });

  const rows = (data ?? []) as unknown as ExportRow[];
  const header = [
    "date",
    "session",
    "exercise",
    "primary_muscle",
    "set_number",
    "type",
    "weight_kg",
    "reps",
    "rpe",
    "est_1rm_kg",
    "volume_kg",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    const ex = r.session_exercise?.exercise;
    const sess = r.session_exercise?.session;
    const w = Number(r.weight_kg ?? 0);
    const reps = Number(r.reps ?? 0);
    const working = !r.is_warmup;
    lines.push(
      [
        cell(sess?.date),
        cell(sess?.title),
        cell(ex?.name),
        cell(ex?.primary_muscle),
        cell(r.set_number),
        cell(working ? "working" : "warmup"),
        cell(w),
        cell(reps),
        cell(r.rpe ?? ""),
        cell(working ? Math.round(w * (1 + reps / 30) * 10) / 10 : ""),
        cell(working ? Math.round(w * reps * 10) / 10 : ""),
      ].join(","),
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hell-blazer-export-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
