"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  CalendarRange,
  ChevronRight,
  Loader2,
  Plus,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConfirmIconButton } from "@/components/ui/confirm-icon-button";
import { Sheet } from "@/components/ui/sheet";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { ProgramProgressCard } from "@/components/program/program-progress-card";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { ProgramProgress, ProgramWithDays } from "@/lib/data/programs";
import type { TemplateWithExercises } from "@/lib/data/templates";
import type { Preset } from "@/lib/presets";
import {
  createProgram,
  deleteProgram,
  setActiveProgram,
} from "@/lib/actions/programs";
import { loadPreset } from "@/lib/actions/templates";

const DURATIONS = [4, 6, 8, 12, 16];

export function ProgramsManager({
  programs,
  templates,
  activeProgress,
  presets,
}: {
  programs: ProgramWithDays[];
  templates: TemplateWithExercises[];
  activeProgress: ProgramProgress | null;
  presets: Preset[];
}) {
  const [pending, start] = useTransition();
  const [creating, setCreating] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        title="Programs"
        subtitle="Build a training block, set how many weeks to run it, and go."
        action={
          <Button
            onClick={() => setCreating(true)}
            disabled={templates.length === 0}
            title={
              templates.length === 0
                ? "Build a template first — programs are made from templates"
                : undefined
            }
          >
            <Plus className="size-4" />
            New program
          </Button>
        }
      />

      {activeProgress && (
        <div className="mb-6">
          <ProgramProgressCard
            progress={activeProgress}
            href={`/programs/${activeProgress.program.id}`}
          />
        </div>
      )}

      {/* Starter programs — load a proven split (any number of times) */}
      {presets.length > 0 && (
        <Card className="mb-6 border-accent/20 bg-accent/[0.03] p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-text">
            <Sparkles className="size-4 text-accent" />
            Starter programs
          </div>
          <p className="mt-1 text-xs text-muted">
            Load a proven, strength-first split — it becomes a ready-to-run
            active program. Load any of them again whenever you want a fresh
            block.
          </p>
          <div className="mt-3 grid gap-3">
            {presets.map((p) => (
              <div
                key={p.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text">{p.name}</div>
                  <p className="mt-0.5 text-xs leading-5 text-muted">
                    {p.description}
                  </p>
                  <div className="mt-1 font-mono text-xs text-muted">
                    {p.days.length} days/week · {p.weeks ?? 8} weeks ·{" "}
                    {p.days.reduce((n, d) => n + d.exercises.length, 0)} exercises
                  </div>
                </div>
                <Button
                  variant="secondary"
                  className="shrink-0"
                  disabled={pending}
                  onClick={() => {
                    setLoadingId(p.id);
                    start(async () => {
                      try {
                        await loadPreset({ presetId: p.id });
                      } finally {
                        setLoadingId(null);
                      }
                    });
                  }}
                >
                  {loadingId === p.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  {loadingId === p.id ? "Loading…" : "Load"}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {programs.length === 0 ? (
        <EmptyState
          icon={<CalendarRange className="size-6" />}
          title="No programs yet"
          body="Load a starter program above, or build your own from templates."
        />
      ) : (
        <div className="grid gap-3">
          <div className="px-1 text-xs font-medium uppercase tracking-wide text-muted">
            All programs · tap “Make active” to switch
          </div>
          {programs.map((p) => (
            <Card
              key={p.id}
              className="flex items-center gap-3 p-4 transition-[transform,border-color] hover:border-accent/40 active:scale-[0.99]"
            >
              <Link href={`/programs/${p.id}`} className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-text">
                    {p.name}
                  </span>
                  {p.is_active && <Badge variant="accent">Active</Badge>}
                </div>
                <div className="mt-0.5 font-mono text-xs text-muted">
                  {p.duration_weeks} weeks · {p.program_day.length} days/week
                  {p.start_date
                    ? ` · from ${format(new Date(p.start_date + "T00:00:00"), "MMM d")}`
                    : ""}
                </div>
              </Link>
              {!p.is_active && (
                <button
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await setActiveProgram({ id: p.id, active: true });
                    })
                  }
                  className="shrink-0 rounded-md border border-accent/30 px-2.5 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/10"
                >
                  Make active
                </button>
              )}
              <ConfirmIconButton
                label="Delete program"
                confirmLabel="Tap again to delete program"
                disabled={pending}
                onConfirm={() =>
                  start(async () => {
                    await deleteProgram({ id: p.id });
                  })
                }
              />
              <Link href={`/programs/${p.id}`} aria-label="Open program">
                <ChevronRight className="size-4 shrink-0 text-muted" />
              </Link>
            </Card>
          ))}
        </div>
      )}

      <CreateProgramSheet
        open={creating}
        onClose={() => setCreating(false)}
        templates={templates}
      />
    </div>
  );
}

function CreateProgramSheet({
  open,
  onClose,
  templates,
}: {
  open: boolean;
  onClose: () => void;
  templates: TemplateWithExercises[];
}) {
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [weeks, setWeeks] = useState(8);
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function submit() {
    if (!name.trim() || selected.length === 0) return;
    start(async () => {
      await createProgram({
        name: name.trim(),
        durationWeeks: weeks,
        startDate,
        templateIds: selected,
        setActive: true,
      });
      onClose();
      setName("");
      setSelected([]);
      setWeeks(8);
    });
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="New program"
      footer={
        <Button
          onClick={submit}
          disabled={pending || !name.trim() || selected.length === 0}
          className="w-full"
          size="lg"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Create &amp; activate
        </Button>
      }
    >
      <div className="grid gap-5 p-4">
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-muted">Program name</span>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Winter Strength Block"
          />
        </label>

        <div className="grid gap-1.5">
          <span className="text-xs font-medium text-muted">Run it for</span>
          <div className="flex flex-wrap items-center gap-2">
            {DURATIONS.map((w) => (
              <button
                key={w}
                onClick={() => setWeeks(w)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  weeks === w
                    ? "border-accent/50 bg-accent/10 text-accent"
                    : "border-border text-muted hover:text-text",
                )}
              >
                {w} wks
              </button>
            ))}
            <Input
              type="number"
              min={1}
              max={52}
              value={weeks}
              onChange={(e) =>
                setWeeks(Math.max(1, Math.min(52, Number(e.target.value) || 1)))
              }
              className="w-20"
              aria-label="Custom weeks"
            />
          </div>
        </div>

        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-muted">Start date</span>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="sm:w-48"
          />
        </label>

        <div className="grid gap-2">
          <span className="text-xs font-medium text-muted">
            Weekly schedule{" "}
            <span className="text-muted/60">
              — tap templates in order ({selected.length} selected)
            </span>
          </span>
          <div className="grid gap-2">
            {templates.map((t) => {
              const order = selected.indexOf(t.id);
              const active = order >= 0;
              return (
                <button
                  key={t.id}
                  onClick={() => toggle(t.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                    active
                      ? "border-accent/40 bg-accent/[0.06]"
                      : "border-border hover:border-border/80",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-md font-mono text-xs",
                      active
                        ? "bg-accent text-bg"
                        : "border border-border text-muted",
                    )}
                  >
                    {active ? order + 1 : ""}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-text">
                      {t.name}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {t.template_exercise.length} exercises
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Sheet>
  );
}
