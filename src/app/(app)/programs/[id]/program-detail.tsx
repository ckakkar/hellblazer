"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Eye,
  Loader2,
  Plus,
  Power,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { ProgramProgressCard } from "@/components/program/program-progress-card";
import { StartWorkoutButton } from "@/components/program/start-workout-button";
import {
  PauseResumeButton,
  RollbackButton,
} from "@/components/program/program-controls";
import { DayPreview } from "@/components/program/day-preview";
import { cn } from "@/lib/utils";
import type { ProgramProgress, ProgramWithDays } from "@/lib/data/programs";
import type { TemplateWithExercises } from "@/lib/data/templates";
import type { Exercise } from "@/lib/data/exercises";
import {
  addProgramDay,
  deleteProgram,
  moveProgramDay,
  removeProgramDay,
  resetProgram,
  setActiveProgram,
  updateProgram,
} from "@/lib/actions/programs";

const DURATIONS = [4, 6, 8, 12, 16];

export function ProgramDetail({
  program,
  progress,
  templates,
  exercises,
}: {
  program: ProgramWithDays;
  progress: ProgramProgress;
  templates: TemplateWithExercises[];
  exercises: Exercise[];
}) {
  const [pending, start] = useTransition();
  const [picker, setPicker] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [previewDayId, setPreviewDayId] = useState<string | null>(null);
  const days = program.program_day;
  const previewDay = days.find((d) => d.id === previewDayId) ?? null;
  const previewTemplate = previewDay
    ? templates.find((t) => t.id === previewDay.template_id) ?? null
    : null;

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/programs"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-text"
      >
        <ArrowLeft className="size-4" />
        Programs
      </Link>

      <input
        defaultValue={program.name}
        aria-label="Program name"
        onBlur={(e) => {
          const val = e.target.value.trim();
          if (val && val !== program.name)
            start(async () => {
              await updateProgram({ id: program.id, name: val });
            });
        }}
        className="mb-5 w-full bg-transparent font-display text-2xl font-semibold tracking-tight text-text focus:outline-none"
      />

      <ProgramProgressCard progress={progress} />

      {/* Day-to-day controls: pause the block, or roll back the last advance */}
      {program.start_date && !progress.isCompleted && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <PauseResumeButton
            programId={program.id}
            isPaused={progress.isPaused}
            size="sm"
          />
          {progress.lastAdvance && (
            <RollbackButton
              programId={program.id}
              lastAdvance={progress.lastAdvance}
            />
          )}
          {progress.skipsThisWeek > 0 && (
            <span className="text-xs text-muted">
              {progress.skipsThisWeek} skipped this week
            </span>
          )}
        </div>
      )}

      {/* Block settings */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Block settings</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-1.5">
            <span className="text-xs font-medium text-muted">Run it for</span>
            <div className="flex flex-wrap items-center gap-2">
              {DURATIONS.map((w) => (
                <button
                  key={w}
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await updateProgram({
                        id: program.id,
                        durationWeeks: w,
                      });
                    })
                  }
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                    program.duration_weeks === w
                      ? "border-accent/50 bg-accent/10 text-accent"
                      : "border-border text-muted hover:text-text",
                  )}
                >
                  {w} wks
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted">Start date</span>
              <Input
                type="date"
                defaultValue={program.start_date ?? ""}
                onBlur={(e) =>
                  e.target.value &&
                  e.target.value !== program.start_date &&
                  start(async () => {
                    await updateProgram({
                      id: program.id,
                      startDate: e.target.value,
                    });
                  })
                }
                className="w-44"
              />
            </label>
            <Button
              variant={program.is_active ? "outline" : "secondary"}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await setActiveProgram({
                    id: program.id,
                    active: !program.is_active,
                  });
                })
              }
            >
              <Power className="size-4" />
              {program.is_active ? "Deactivate" : "Set as active"}
            </Button>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await resetProgram({ id: program.id });
                })
              }
            >
              <RotateCcw className="size-4" />
              Restart at week 1
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Weekly schedule */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Weekly schedule</CardTitle>
        </CardHeader>
        <div className="border-t border-border">
          <ul className="divide-y divide-border">
            {days.map((d, i) => {
              const tmpl = d.workout_template;
              return (
                <li
                  key={d.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-2 font-mono text-xs text-muted">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-text">
                      {tmpl?.day_label || tmpl?.name || "Deleted template"}
                    </div>
                    <div className="font-mono text-xs text-muted">
                      {tmpl ? `${tmpl.template_exercise.length} exercises` : "—"}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col">
                    <button
                      disabled={i === 0 || pending}
                      aria-label="Move up"
                      onClick={() =>
                        start(async () => {
                          await moveProgramDay({
                            id: d.id,
                            programId: program.id,
                            direction: "up",
                          });
                        })
                      }
                      className="text-muted hover:text-text disabled:opacity-30"
                    >
                      <ChevronUp className="size-4" />
                    </button>
                    <button
                      disabled={i === days.length - 1 || pending}
                      aria-label="Move down"
                      onClick={() =>
                        start(async () => {
                          await moveProgramDay({
                            id: d.id,
                            programId: program.id,
                            direction: "down",
                          });
                        })
                      }
                      className="text-muted hover:text-text disabled:opacity-30"
                    >
                      <ChevronDown className="size-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => setPreviewDayId(d.id)}
                    aria-label="Preview this day"
                    title="Preview this day"
                    className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-muted transition-colors hover:border-accent/40 hover:text-accent"
                  >
                    <Eye className="size-4" />
                  </button>
                  {tmpl && (
                    <StartWorkoutButton
                      programDayId={d.id}
                      label="Start"
                      variant="secondary"
                      size="sm"
                    />
                  )}
                  <button
                    aria-label="Remove day"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        await removeProgramDay({
                          id: d.id,
                          programId: program.id,
                        });
                      })
                    }
                    className="shrink-0 text-muted transition-colors hover:text-danger"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              );
            })}
            {days.length === 0 && (
              <li className="px-4 py-4 text-sm text-muted">No days yet.</li>
            )}
          </ul>
          <div className="p-3">
            <Button variant="outline" size="sm" onClick={() => setPicker(true)}>
              <Plus className="size-4" />
              Add training day
            </Button>
          </div>
        </div>
      </Card>

      {/* Danger zone */}
      <div className="mt-6 flex justify-end">
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Delete this program?</span>
            <Button
              variant="danger"
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await deleteProgram({ id: program.id });
                })
              }
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : "Delete"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="danger"
            size="sm"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="size-4" />
            Delete program
          </Button>
        )}
      </div>

      {/* Add-day picker */}
      <Sheet open={picker} onClose={() => setPicker(false)} title="Add a day">
        <ul className="divide-y divide-border">
          {templates.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => {
                  start(async () => {
                    await addProgramDay({
                      programId: program.id,
                      templateId: t.id,
                    });
                  });
                  setPicker(false);
                }}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm text-text">{t.name}</div>
                  <div className="text-xs text-muted">
                    {t.template_exercise.length} exercises
                  </div>
                </div>
                <Plus className="size-4 text-muted" />
              </button>
            </li>
          ))}
          {templates.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-muted">
              No templates yet — create one first.
            </li>
          )}
        </ul>
      </Sheet>

      {/* Preview a day without starting it */}
      {previewDay && (
        <DayPreview
          onClose={() => setPreviewDayId(null)}
          template={previewTemplate}
          programDayId={previewDay.id}
          dayTitle={
            previewTemplate?.day_label ||
            previewTemplate?.name ||
            "Workout"
          }
          exercises={exercises}
        />
      )}
    </div>
  );
}
