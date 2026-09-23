import type { Metadata } from "next";
import { ViewTransition } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Pencil } from "lucide-react";
import { getSessionDetail } from "@/lib/data/sessions";
import { getUnit } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { formatVolume, toDisplayWeight, trimNum } from "@/lib/units";
import { MUSCLE_LABEL } from "@/lib/muscles";
import { DeleteSessionButton } from "./delete-session-button";
import { ShareCardButton } from "./share-card-button";

export const metadata: Metadata = { title: "Session" };

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
    <div className="mx-auto max-w-4xl">
      <Link
        href="/history"
        transitionTypes={["nav-back"]}
        className="-ml-1 mb-3 inline-flex h-9 items-center gap-1 rounded-full pl-1 pr-3 text-[15px] text-muted transition-colors hover:text-text"
      >
        <ArrowLeft className="size-4" />
        History
      </Link>

      <PageHeader
        title={
          // Pairs with the row in History and on the dashboard: the title
          // morphs from the list into this heading.
          <ViewTransition name={`session-${session.id}`} share="hb-morph" default="none">
            <span>{session.title ?? "Session"}</span>
          </ViewTransition>
        }
        subtitle={session.date ? format(parseISO(session.date), "EEEE, MMM d, yyyy") : undefined}
        action={
          <div className="flex items-center gap-2">
          <ShareCardButton
            sessionId={session.id}
            title={session.title ?? "Session"}
          />
          <Link href={`/log/${session.id}`}>
            <Button variant="secondary" size="sm">
              <Pencil className="size-4" />
              Edit
            </Button>
          </Link>
          <DeleteSessionButton sessionId={session.id} />
          </div>
        }
      />

      <div className="mb-8 grid grid-cols-[1.3fr_0.9fr_1fr] divide-x divide-white/[0.06] rounded-2xl bg-surface py-4">
        {[
          { label: "Volume", value: formatVolume(totalVolume, unit) },
          { label: "Sets", value: String(totalSets) },
          { label: "Duration", value: session.duration_min ? `${session.duration_min} min` : "Not timed" },
        ].map((st) => (
          <div key={st.label} className="min-w-0 px-3.5">
            <p className="text-[13px] text-muted">{st.label}</p>
            <p className="font-display mt-1.5 whitespace-nowrap text-[clamp(1.125rem,5vw,1.5rem)] leading-none text-text">
              {st.value}
            </p>
          </div>
        ))}
      </div>

      {session.notes && (
        <Card className="mb-4 p-4 text-[15px] leading-[1.5] text-muted">{session.notes}</Card>
      )}

      <div className="grid items-start gap-3 lg:grid-cols-2">
        {session.session_exercise.map((se) => {
          const working = se.set.filter((s) => !s.is_warmup);
          const exVolume = working.reduce(
            (n, s) => n + s.weight_kg * s.reps,
            0,
          );
          return (
            <Card key={se.id} className="overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
                <div className="min-w-0">
                  <div className="truncate text-[17px] font-semibold tracking-[-0.015em] text-text">
                    {se.exercise?.name ?? "Exercise"}
                  </div>
                  {se.exercise && (
                    <div className="text-[13px] text-muted">
                      {MUSCLE_LABEL[se.exercise.primary_muscle]}
                    </div>
                  )}
                </div>
                <span className="tnum shrink-0 text-[13px] text-muted">{formatVolume(exVolume, unit)}</span>
              </div>
              <ul className="divide-y divide-white/[0.05] px-1 pb-1">
                {se.set.map((s, i) => {
                  const est1rm = s.weight_kg * (1 + s.reps / 30);
                  return (
                    <li
                      key={s.id}
                      className="tnum flex items-center justify-between gap-3 px-3 py-2.5 text-[15px]"
                    >
                      <span className="w-14 shrink-0 text-[13px] text-muted">
                        {s.is_warmup ? "Warm-up" : `Set ${i + 1}`}
                      </span>
                      <span className="flex-1 text-text">
                        {trimNum(toDisplayWeight(s.weight_kg, unit))}
                        <span className="text-muted">{unit}</span> × {s.reps}
                      </span>
                      {s.rpe != null && (
                        <span className="text-[13px] text-muted">RPE {s.rpe}</span>
                      )}
                      {!s.is_warmup && (
                        <span className="w-20 shrink-0 text-right text-[13px] text-muted">
                          1RM {trimNum(toDisplayWeight(est1rm, unit))}
                        </span>
                      )}
                    </li>
                  );
                })}
                {se.set.length === 0 && (
                  <li className="px-3 py-3 text-[15px] text-muted">
                    No sets logged.
                  </li>
                )}
              </ul>
            </Card>
          );
        })}
        {session.session_exercise.length === 0 && (
          <Card className="p-6 text-center text-[15px] text-muted">
            This session has no exercises.
          </Card>
        )}
      </div>
    </div>
  );
}
