import type { Metadata } from "next";
import { ViewTransition } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Pencil } from "lucide-react";
import { getSessionDetail } from "@/lib/data/sessions";
import { getProfile } from "@/lib/data/profile";
import { profileAge } from "@/lib/age";
import { estimatedMaxHr, type TimedSet } from "@/lib/heart-insights";
import { HeartCard } from "@/components/workout/heart-card";
import { slotLabel, supersetSlots } from "@/lib/supersets";
import { getUnit } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { formatVolume, toDisplayWeight, trimNum } from "@/lib/units";
import { MUSCLE_LABEL } from "@/lib/muscles";
import { fitFigure } from "@/lib/utils";
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
  const [session, unit, profile] = await Promise.all([getSessionDetail(id), getUnit(), getProfile()]);
  if (!session) notFound();

  // The heart-rate read (iPhone app only): the workout's span and when each
  // set was logged. A session left open for hours wasn't that long a
  // workout, so its logged duration says when it ended.
  const start = Date.parse(session.created_at);
  const finished = session.finished_at ? Date.parse(session.finished_at) : null;
  const end =
    finished == null
      ? null
      : finished - start <= 4 * 3_600_000
        ? finished
        : session.duration_min
          ? start + session.duration_min * 60_000
          : null;
  const timedSets: TimedSet[] = session.session_exercise.flatMap((se) =>
    se.set.map((s) => ({
      at: Date.parse(s.created_at),
      key: se.id,
      exercise: se.exercise?.name ?? "Exercise",
      warmup: s.is_warmup,
    })),
  );
  const slots = supersetSlots(session.session_exercise, (se) => se.superset);
  const maxHr = estimatedMaxHr(session.date ? profileAge(profile, session.date) : null);

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
        className="-ml-1 mb-3 hidden h-9 items-center gap-1 rounded-full pl-1 pr-3 text-[15px] text-muted transition-colors hover:text-text md:inline-flex"
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
          <div className="flex flex-wrap items-center gap-2">
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
          { label: "Duration", value: session.duration_min ? `${session.duration_min} min` : null },
        ].map((st) => (
          <div key={st.label} className="@container min-w-0 px-3 min-[400px]:px-3.5">
            <p className="text-[13px] text-muted">{st.label}</p>
            <p className="mt-1.5 flex h-6 items-end whitespace-nowrap leading-none">
              {st.value ? (
                <span
                  className="font-display hb-fit text-text"
                  style={fitFigure(st.value, "clamp(1.125rem, 5vw, 1.5rem)")}
                >
                  {st.value}
                </span>
              ) : (
                <span className="text-[15px] text-muted">Not timed</span>
              )}
            </p>
          </div>
        ))}
      </div>

      {end != null && end > start && (
        <HeartCard sessionId={session.id} start={start} end={end} sets={timedSets} maxHr={maxHr} />
      )}

      {session.notes && (
        <Card className="mb-4 p-4 text-[15px] leading-[1.5] text-muted">{session.notes}</Card>
      )}

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
        {session.session_exercise.map((se, index) => {
          const working = se.set.filter((s) => !s.is_warmup);
          const exVolume = working.reduce(
            (n, s) => n + s.weight_kg * s.reps,
            0,
          );
          return (
            <Card key={se.id} className="@container overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    {slots[index] && (
                      <span className="tnum shrink-0 rounded-md bg-white/[0.08] px-1.5 py-0.5 text-[12px] font-semibold text-text">
                        {slotLabel(slots[index])}
                      </span>
                    )}
                    <span className="truncate text-[17px] font-semibold tracking-[-0.015em] text-text">
                      {se.exercise?.name ?? "Exercise"}
                    </span>
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
                  // Plain sets are numbered on their own; the rest say what they are.
                  const label = s.is_warmup
                    ? "Warm-up"
                    : s.kind === "drop"
                      ? "Drop"
                      : s.kind === "rest_pause"
                        ? "Rest-pause"
                        : `Set ${se.set.slice(0, i + 1).filter((x) => !x.is_warmup && !x.kind).length}`;
                  return (
                    <li
                      key={s.id}
                      className="tnum flex items-center justify-between gap-3 px-3 py-2.5 text-[15px]"
                    >
                      <span className="w-14 shrink-0 text-[13px] text-muted">{label}</span>
                      {/* In a phone-width card the RPE drops under the
                          weight rather than squeezing it onto two lines. */}
                      <span className="min-w-0 flex-1 text-text">
                        <span className="whitespace-nowrap">
                          {trimNum(toDisplayWeight(s.weight_kg, unit))}
                          <span className="text-muted">{unit}</span> × {s.reps}
                        </span>
                        {s.rpe != null && (
                          <span className="block text-[13px] text-muted @sm:hidden">RPE {s.rpe}</span>
                        )}
                      </span>
                      {s.rpe != null && (
                        <span className="hidden shrink-0 whitespace-nowrap text-[13px] text-muted @sm:inline">
                          RPE {s.rpe}
                        </span>
                      )}
                      {!s.is_warmup && (
                        <span className="shrink-0 whitespace-nowrap text-right text-[13px] text-muted @sm:w-20">
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
