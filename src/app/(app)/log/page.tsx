import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { getTemplates } from "@/lib/data/templates";
import { getActiveProgramProgress } from "@/lib/data/programs";
import { getActiveSession } from "@/lib/data/sessions";
import { ProgramProgressCard } from "@/components/program/program-progress-card";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { SessionStarter } from "./session-starter";
import { isIPadApp } from "@/lib/surface";

export const metadata: Metadata = { title: "Log workout" };

export const dynamic = "force-dynamic";

export default async function LogPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string }>;
}) {
  const [templates, activeProgress, activeSession, { start }, ipad] = await Promise.all([
    getTemplates(),
    getActiveProgramProgress(),
    getActiveSession(),
    searchParams,
    isIPadApp(),
  ]);

  // Nothing starts on an iPad (a widget or Siri can still land here): show
  // the workout under way, or home.
  if (ipad) redirect(activeSession && !activeSession.stale ? `/log/${activeSession.id}` : "/dashboard");

  // Full template details (movements, target sets/reps) for the preview dropdown,
  // keyed by id: the program-day select only carries exercise counts.
  const templateById = new Map(templates.map((t) => [t.id, t]));
  const previewExercises = (id: string) =>
    (templateById.get(id)?.template_exercise ?? []).map((te) => ({
      name: te.exercise?.name ?? "Exercise",
      muscle: te.exercise?.primary_muscle ?? null,
      targetSets: te.target_sets,
      targetRepRange: te.target_rep_range,
    }));

  // Only offer the days of the current split (the active program), not every
  // template ever loaded. With no active program, fall back to all templates.
  // `programDayId` is what makes a start count toward the block, as that day:
  // each day of the program is its own option, so a template used on two
  // days of a rotation is offered twice, and starting Day 3 counts as Day 3.
  // Anything else is deliberately off-plan.
  type Opt = {
    /** The option's own key: its program day, else its template. */
    key: string;
    id: string;
    programDayId: string | null;
    name: string;
    day_label: string | null;
    count: number;
    exercises: ReturnType<typeof previewExercises>;
  };
  const options: Opt[] = [];
  const pushOption = (
    id: string,
    name: string,
    day_label: string | null,
    programDayId: string | null,
  ) => {
    const exercises = previewExercises(id);
    options.push({
      key: programDayId ?? id,
      id,
      programDayId,
      name,
      day_label,
      count: exercises.length,
      exercises,
    });
  };
  if (activeProgress) {
    for (const d of activeProgress.program.program_day) {
      const t = d.workout_template;
      if (t) pushOption(t.id, t.name, t.day_label, d.id);
    }
  } else {
    for (const t of templates) {
      pushOption(t.id, t.name, t.day_label, null);
    }
  }
  const hasProgramNext = Boolean(activeProgress?.nextDay?.template_id);

  // Siri and Spotlight in the iOS app open /log?start=<template id> to begin
  // that day at once. Only a day offered here counts, and a workout already
  // in progress wins: that's where they land instead. A template on two
  // days starts as the first of them not yet done this week.
  const openDays = new Set(
    activeProgress?.program.program_day.filter((_, i) => activeProgress.dayStatus[i] === null).map((d) => d.id),
  );
  const autoStart = start
    ? (options.find((o) => o.id === start && o.programDayId && openDays.has(o.programDayId)) ??
      options.find((o) => o.id === start) ??
      null)
    : null;
  if (autoStart && activeSession && !activeSession.stale) {
    redirect(`/log/${activeSession.id}`);
  }

  // Only promise a week when the block is actually accruing one. A paused,
  // finished, or not-yet-started program still owns the session, but claiming
  // "counts toward Week N" there would be a lie.
  const countsLabel =
    activeProgress &&
    activeProgress.currentWeek &&
    !activeProgress.isCompleted &&
    !activeProgress.isPaused
      ? `Counts toward week ${activeProgress.currentWeek}`
      : null;

  const showCard = Boolean(activeProgress && hasProgramNext);

  return (
    <div className={showCard ? "mx-auto max-w-4xl lg:max-w-none" : "mx-auto max-w-4xl"}>
      <PageHeader
        title="Log"
        subtitle={
          options.length === 0 && !activeProgress
            ? "Start an empty workout, or pick a program to train from a plan."
            : "Start your next programmed day, or pick any other."
        }
      />

      {/* On a desktop, what's next stays in view on the left while the rest
          of the week is picked from on the right. */}
      <div className={showCard ? "lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start lg:gap-8" : undefined}>
        {activeProgress && hasProgramNext && (
          <div className="mb-10 lg:sticky lg:top-10 lg:mb-0">
            <ProgramProgressCard
              progress={activeProgress}
              activeSession={activeSession}
              href={`/programs/${activeProgress.program.id}`}
            />
          </div>
        )}

        {options.length === 0 && !activeProgress ? (
          <div className="grid grid-cols-1 gap-4">
            <SessionStarter templates={[]} hasActiveProgram={false} countsLabel={null} />
            <EmptyState
              icon={<CalendarRange className="size-6" />}
              title="No program or templates yet"
              body="Pick a starter program or build your own, and its days show up here, ready to start."
              action={
                <Link href="/programs" className={buttonVariants({ variant: "secondary" })}>
                  Go to Programs
                </Link>
              }
            />
          </div>
        ) : (
          <SessionStarter
            templates={options}
            hasActiveProgram={Boolean(activeProgress)}
            countsLabel={countsLabel}
            autoStart={
              autoStart ? { templateId: autoStart.id, programDayId: autoStart.programDayId } : null
            }
          />
        )}
      </div>
    </div>
  );
}
