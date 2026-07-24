import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Pencil } from "lucide-react";
import { getSessionDetail } from "@/lib/data/sessions";
import { getUnit } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatVolume, toDisplayWeight, trimNum } from "@/lib/units";
import { MUSCLE_LABEL } from "@/lib/muscles";
import { DeleteSessionButton } from "./delete-session-button";

export const dynamic = "force-dynamic";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [session, unit] = await Promise.all([getSessionDetail(id), getUnit()]);
  if (!session) notFound();

  let totalVolume = 0;
  let totalSets = 0;
  for (const se of session.session_exercise) {
    for (const s of se.set) {
      if (!s.is_warmup && s.is_completed) {
        totalVolume += s.weight_kg * s.reps;
        totalSets += 1;
      }
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/history"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-text"
      >
        <ArrowLeft className="size-4" />
        History
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-text">
            {session.title ?? "Session"}
          </h1>
          <div className="mt-1 font-mono text-xs text-muted">
            {session.date ? format(parseISO(session.date), "EEEE, MMM d, yyyy") : ""}
            {" · "}
            {totalSets} sets · {formatVolume(totalVolume, unit)}
            {session.duration_min ? ` · ${session.duration_min}min` : ""}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/log/${session.id}`}>
            <Button variant="secondary" size="sm">
              <Pencil className="size-4" />
              Edit
            </Button>
          </Link>
          <DeleteSessionButton sessionId={session.id} />
        </div>
      </div>

      {session.notes && (
        <Card className="mb-4 p-4 text-sm text-muted">{session.notes}</Card>
      )}

      <div className="grid gap-3">
        {session.session_exercise.map((se) => {
          const working = se.set.filter((s) => !s.is_warmup);
          const exVolume = working.reduce(
            (n, s) => n + s.weight_kg * s.reps,
            0,
          );
          return (
            <Card key={se.id} className="overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-border p-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-text">
                    {se.exercise?.name ?? "Exercise"}
                  </div>
                  {se.exercise && (
                    <div className="text-xs text-muted">
                      {MUSCLE_LABEL[se.exercise.primary_muscle]}
                    </div>
                  )}
                </div>
                <Badge variant="muted">{formatVolume(exVolume, unit)}</Badge>
              </div>
              <ul className="divide-y divide-border">
                {se.set.map((s, i) => {
                  const est1rm = s.weight_kg * (1 + s.reps / 30);
                  return (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 font-mono text-sm"
                    >
                      <span className="w-16 shrink-0 text-xs text-muted">
                        {s.is_warmup ? "warm" : `Set ${i + 1}`}
                      </span>
                      <span className="flex-1 text-text">
                        {trimNum(toDisplayWeight(s.weight_kg, unit))}
                        <span className="text-muted">{unit}</span> × {s.reps}
                      </span>
                      {s.rpe != null && (
                        <span className="text-xs text-muted">RPE {s.rpe}</span>
                      )}
                      {!s.is_warmup && (
                        <span className="w-20 shrink-0 text-right text-xs text-muted">
                          1RM {trimNum(toDisplayWeight(est1rm, unit))}
                        </span>
                      )}
                    </li>
                  );
                })}
                {se.set.length === 0 && (
                  <li className="px-4 py-3 text-sm text-muted">
                    No sets logged.
                  </li>
                )}
              </ul>
            </Card>
          );
        })}
        {session.session_exercise.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted">
            This session has no exercises.
          </Card>
        )}
      </div>
    </div>
  );
}
