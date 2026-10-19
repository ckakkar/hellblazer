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
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { formatVolume, toDisplayWeight, trimNum } from "@/lib/units";
import { MUSCLE_LABEL } from "@/lib/muscles";
import { cn, fitFigure } from "@/lib/utils";
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
        subtitle={session.date ? format(parseISO(session.date), "EEEE d MMMM yyyy") : undefined}
        action={
          <div className="flex flex-wrap items-center gap-2">
          <ShareCardButton
            sessionId={session.id}
            title={session.title ?? "Session"}
          />
          {/* `edit`: on an iPad, /log/[id] is otherwise the live view. */}
          <Link
            href={`/log/${session.id}?edit`}
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            <Pencil className="size-4" />
            Edit
          </Link>
          <DeleteSessionButton sessionId={session.id} />
          </div>
        }
      />

      <div className="mb-8 grid grid-cols-[1.3fr_0.9fr_1fr] divide-x divide-text/[0.08] border-y border-text/[0.12] py-3.5">
        {[
          { label: "Volume", value: formatVolume(totalVolume, unit) },
          { label: "Sets", value: String(totalSets) },
          { label: "Duration", value: session.duration_min ? `${session.duration_min} min` : null },
        ].map((st) => (
          <div key={st.label} className="@container min-w-0 px-3 first:pl-1 min-[400px]:px-3.5 min-[400px]:first:pl-1">
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
        <p className="mb-8 border-l-2 border-text/[0.15] pl-4 text-[15px] leading-[1.5] text-text/80">{session.notes}</p>
      )}

      {/* The workout as its log: each exercise ruled off with its sets in
          columns, so the weights read straight down. */}
      <div className="grid grid-cols-1 items-start gap-x-10 gap-y-9 lg:grid-cols-2">
        {session.session_exercise.map((se, index) => {
          const working = se.set.filter((s) => !s.is_warmup);
          const exVolume = working.reduce(
            (n, s) => n + s.weight_kg * s.reps,
            0,
          );
          return (
            <section key={se.id} className="min-w-0">
              <div className="flex items-end justify-between gap-2 px-1 pb-2.5">
                <div className="min-w-0">
                  <h2 className="flex min-w-0 items-center gap-2">
                    {slots[index] && (
                      <span className="tnum shrink-0 rounded-md bg-text/[0.08] px-1.5 py-0.5 text-[12px] font-semibold text-text">
                        {slotLabel(slots[index])}
                      </span>
                    )}
                    <span className="truncate text-[17px] font-semibold tracking-[-0.015em] text-text">
                      {se.exercise?.name ?? "Exercise"}
                    </span>
                  </h2>
                  {se.exercise && (
                    <p className="text-[13px] text-muted">{MUSCLE_LABEL[se.exercise.primary_muscle]}</p>
                  )}
                </div>
                <span className="tnum shrink-0 text-[13px] text-muted">{formatVolume(exVolume, unit)}</span>
              </div>
              {se.set.length === 0 ? (
                <p className="border-y border-text/[0.12] px-1 py-3 text-[15px] text-muted">No sets logged.</p>
              ) : (
                <table className="tnum w-full border-y border-text/[0.12] text-[15px]">
                  <thead>
                    <tr className="border-b border-text/[0.08] text-[12px] text-muted">
                      <th scope="col" className="py-2 pl-1 text-left font-normal">Set</th>
                      <th scope="col" className="w-16 py-2 text-right font-normal">{unit}</th>
                      <th scope="col" className="w-12 py-2 text-right font-normal">Reps</th>
                      <th scope="col" className="w-11 py-2 text-right font-normal">RPE</th>
                      <th scope="col" className="w-16 py-2 pr-1 text-right font-normal">
                        <abbr title="Estimated one-rep max (Epley)" className="no-underline">e1RM</abbr>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-text/[0.06]">
                    {se.set.map((s, i) => {
                      const est1rm = s.weight_kg * (1 + s.reps / 30);
                      // Plain sets are numbered on their own; the rest say what they are.
                      const label = s.is_warmup
                        ? "Warm-up"
                        : s.kind === "drop"
                          ? "Drop"
                          : s.kind === "rest_pause"
                            ? "Rest-pause"
                            : String(se.set.slice(0, i + 1).filter((x) => !x.is_warmup && !x.kind).length);
                      return (
                        <tr key={s.id}>
                          <th
                            scope="row"
                            className={cn(
                              "py-2.5 pl-1 text-left text-[13px] font-normal",
                              s.is_warmup ? "text-warn" : "text-muted",
                            )}
                          >
                            {label}
                          </th>
                          <td className="py-2.5 text-right text-text">{trimNum(toDisplayWeight(s.weight_kg, unit))}</td>
                          <td className="py-2.5 text-right text-text">{s.reps}</td>
                          <td className="py-2.5 text-right text-muted">{s.rpe ?? ""}</td>
                          <td className="py-2.5 pr-1 text-right text-muted">
                            {s.is_warmup ? "" : trimNum(toDisplayWeight(est1rm, unit))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </section>
          );
        })}
        {session.session_exercise.length === 0 && (
          <p className="py-8 text-center text-[15px] text-muted">This session has no exercises.</p>
        )}
      </div>
    </div>
  );
}
