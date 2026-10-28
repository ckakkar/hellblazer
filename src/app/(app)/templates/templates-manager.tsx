"use client";

import { useOptimistic, useRef, useState } from "react";
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Eraser,
  GripVertical,
  Plus,
  Link2,
  Timer,
  Trash2,
  Unlink,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TitleField } from "@/components/ui/title-field";
import { ExercisePicker } from "@/components/exercise-picker";
import { PageHeader, EmptyState, SectionLabel } from "@/components/ui/page-header";
import { slotLabel, supersetSlots } from "@/lib/supersets";
import { MUSCLE_LABEL } from "@/lib/muscles";
import type { Exercise } from "@/lib/data/exercises";
import type { TemplateWithExercises } from "@/lib/data/templates";
import type { Preset } from "@/lib/presets";
import { PresetCarousel } from "@/components/program/preset-carousel";
import {
  addTemplateExercise,
  cleanupTemplates,
  createTemplate,
  deleteTemplate,
  moveTemplateExercise,
  removeTemplateExercise,
  setTemplateSuperset,
  swapTemplateExercise,
  updateTemplate,
  updateTemplateExercise,
} from "@/lib/actions/templates";
import { cn, selectAllOnFocus } from "@/lib/utils";
import { formatRestClock, REST_CHOICES } from "@/lib/rest-timer";
import { useAction } from "@/lib/use-action";
import { showNotice } from "@/lib/notice";
import { Collapse } from "@/components/ui/collapse";
import { useListGlide } from "@/components/ui/use-list-glide";

type TemplateRow = TemplateWithExercises["template_exercise"][number];

export function TemplatesManager({
  templates,
  exercises,
  presets,
  activeTemplateIds,
  activeProgramName,
}: {
  templates: TemplateWithExercises[];
  exercises: Exercise[];
  presets: Preset[];
  activeTemplateIds: string[];
  activeProgramName: string | null;
}) {
  const [pending, start] = useAction("save the change");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showOthers, setShowOthers] = useState(false);
  // The template the pane beside the list edits (`lg` up).
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // "Your split" = the active program's days, in order. Everything else is
  // shown separately so a page full of old loads doesn't drown the current one.
  const byId = new Map(templates.map((t) => [t.id, t]));
  const currentSplit = activeTemplateIds
    .map((id) => byId.get(id))
    .filter((t): t is TemplateWithExercises => Boolean(t));
  const currentIds = new Set(currentSplit.map((t) => t.id));
  const otherTemplates = templates.filter((t) => !currentIds.has(t.id));
  const selected =
    templates.find((t) => t.id === selectedId) ?? currentSplit[0] ?? otherTemplates[0] ?? null;
  const card = (t: TemplateWithExercises) => (
    <TemplateCard
      key={t.id}
      template={t}
      exercises={exercises}
      pending={pending}
      start={start}
      selected={t.id === selected?.id}
      onSelect={() => setSelectedId(t.id)}
    />
  );

  function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    start(async () => {
      await createTemplate({ name });
      setNewName("");
      setCreating(false);
    });
  }

  return (
    <div>
      <PageHeader
        title="Templates"
        subtitle="The days that make up your split: exercises, order, sets and reps."
        action={
          <Button onClick={() => setCreating((v) => !v)}>
            <Plus className="size-4" />
            New template
          </Button>
        }
      />

      {creating && (
        <Card className="mb-6 p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Template name, e.g. Day 1: Upper"
            />
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={pending || !newName.trim()}>
                Create
              </Button>
              <Button variant="ghost" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* From `lg` the list picks and the pane beside it edits. */}
      <div className="lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-6">
        <div className="min-w-0">
          {templates.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="size-6" />}
              title="No templates yet"
              body="Use a starter program below, or create a template from scratch."
            />
          ) : currentSplit.length > 0 ? (
            <>
              <SectionLabel
                action={
                  activeProgramName ? (
                    <span className="truncate text-[13px] text-muted">{activeProgramName}</span>
                  ) : undefined
                }
              >
                Your split
              </SectionLabel>
              <div className="grid grid-cols-1 gap-3">
                {currentSplit.map(card)}
              </div>

              {otherTemplates.length > 0 && (
                <div className="mt-8">
                  <div className="flex items-center justify-between gap-2 px-1">
                    <button
                      onClick={() => setShowOthers((v) => !v)}
                      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-text"
                    >
                      {showOthers ? (
                        <ChevronUp className="size-4" />
                      ) : (
                        <ChevronDown className="size-4" />
                      )}
                      Other templates ({otherTemplates.length})
                    </button>
                    <CleanupButton pending={pending} start={start} />
                  </div>
                  {showOthers && (
                    <div className="mt-3 grid grid-cols-1 gap-3">
                      {otherTemplates.map(card)}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between gap-2 px-1">
                <span className="text-[13px] font-medium text-muted">All templates</span>
                <CleanupButton pending={pending} start={start} />
              </div>
              <div className="grid grid-cols-1 gap-3">
                {otherTemplates.map(card)}
              </div>
            </>
          )}
        </div>
        {selected && (
          <div className="hidden min-w-0 lg:block">
            <TemplatePane key={selected.id} template={selected} exercises={exercises} pending={pending} start={start} />
          </div>
        )}
      </div>

      <div className="mt-10">
        <PresetCarousel presets={presets} />
      </div>
    </div>
  );
}

function CleanupButton({
  pending,
  start,
}: {
  pending: boolean;
  start: (fn: () => Promise<void>) => void;
}) {
  return (
    <button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const removed = await cleanupTemplates();
          showNotice(
            removed > 0
              ? `Removed ${removed} unused starter ${removed === 1 ? "copy" : "copies"}. Your own templates are kept.`
              : "Nothing to clean up. Templates you wrote or changed are always kept.",
          );
        })
      }
      title="Remove starter copies you never changed or trained. Your own templates are always kept."
      className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-[13px] text-muted transition-colors hover:text-text disabled:opacity-45"
    >
      <Eraser className="size-3.5" />
      Clean up
    </button>
  );
}

type Start = (fn: () => Promise<void>) => void;

type RowEdit =
  | { kind: "move"; id: string; direction: "up" | "down" }
  | { kind: "remove"; id: string }
  | { kind: "swap"; id: string; exercise: Exercise };

/** A template's exercises after an edit, as the server will have them. */
function editRows(rows: TemplateRow[], edit: RowEdit): TemplateRow[] {
  const i = rows.findIndex((r) => r.id === edit.id);
  if (i < 0) return rows;
  if (edit.kind === "remove") return rows.filter((r) => r.id !== edit.id);
  if (edit.kind === "swap") {
    return rows.map((r) => (r.id === edit.id ? { ...r, exercise_id: edit.exercise.id, exercise: edit.exercise } : r));
  }
  const j = edit.direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= rows.length) return rows;
  const next = [...rows];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/**
 * One template in the list. On a phone the row opens in place to its
 * exercises; from `lg` it picks the template the pane beside the list edits.
 */
function TemplateCard({
  template,
  exercises,
  pending,
  start,
  selected,
  onSelect,
}: {
  template: TemplateWithExercises;
  exercises: Exercise[];
  pending: boolean;
  start: Start;
  selected: boolean;
  onSelect: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rows = template.template_exercise;

  return (
    <Card
      className={cn(
        "transition-shadow",
        selected && "lg:bg-surface-2 lg:shadow-[inset_0_0_0_1.5px_color-mix(in_oklab,var(--color-text)_30%,transparent)]",
      )}
    >
      <div className="flex items-center gap-3 p-4">
        <button
          onClick={() => {
            onSelect();
            setOpen((v) => !v);
          }}
          aria-expanded={open}
          aria-current={selected ? "true" : undefined}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-[15px] font-medium text-text">
                {template.name}
              </span>
            </div>
            <div className="mt-0.5 truncate text-[13px] text-muted">
              {template.day_label ? `${template.day_label}, ` : ""}
              {rows.length} exercise{rows.length === 1 ? "" : "s"}
            </div>
          </div>
        </button>
        <button
          onClick={() => {
            onSelect();
            setOpen((v) => !v);
          }}
          className="hb-hit flex size-8 shrink-0 items-center justify-center text-muted transition-colors hover:text-text lg:hidden"
          aria-expanded={open}
          aria-label={open ? "Collapse" : "Expand"}
        >
          <ChevronDown className={cn("size-5 transition-transform duration-200", open && "rotate-180")} />
        </button>
        <ChevronRight aria-hidden className="hidden size-5 shrink-0 text-muted lg:block" />
      </div>

      <div className="lg:hidden">
        <Collapse open={open} className="border-t border-border">
          <TemplateExercises template={template} exercises={exercises} pending={pending} start={start} />
        </Collapse>
      </div>
    </Card>
  );
}

/**
 * The template being edited, beside the list (`lg` up: an iPad, a desktop).
 * Room for the whole of it: its name and day label, every exercise's sets,
 * reps, rest, superset and cue, and touch-sized controls.
 */
function TemplatePane({
  template,
  exercises,
  pending,
  start,
}: {
  template: TemplateWithExercises;
  exercises: Exercise[];
  pending: boolean;
  start: Start;
}) {
  const rows = template.template_exercise;
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border px-6 pb-5 pt-6">
        <TitleField
          key={`${template.id}-name`}
          defaultValue={template.name}
          label="Template name"
          onCommit={(value) => {
            const name = value.trim();
            if (name && name !== template.name)
              start(async () => {
                await updateTemplate({ id: template.id, name });
              });
          }}
          className="text-[1.75rem] font-bold leading-[1.1] tracking-[-0.03em] text-text"
        />
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
          <input
            key={`${template.id}-label`}
            defaultValue={template.day_label ?? ""}
            aria-label="Day label"
            placeholder="Day label, e.g. Day 1: Upper"
            onBlur={(e) => {
              const dayLabel = e.target.value.trim();
              if (dayLabel !== (template.day_label ?? ""))
                start(async () => {
                  await updateTemplate({ id: template.id, dayLabel: dayLabel || null });
                });
            }}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className="h-9 min-w-0 flex-1 rounded-lg bg-transparent text-[15px] text-muted placeholder:text-muted/60 focus:bg-surface-2 focus:px-3 focus:text-text focus:outline-none"
          />
          <span className="tnum text-[13px] text-muted">
            {rows.length} exercise{rows.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>
      <TemplateExercises template={template} exercises={exercises} pending={pending} start={start} roomy />
    </Card>
  );
}

/**
 * A template's exercises with their targets. `roomy` is the pane's layout:
 * bigger fields and buttons (a finger on an iPad), and the cue field.
 */
function TemplateExercises({
  template,
  exercises,
  pending,
  start,
  roomy = false,
}: {
  template: TemplateWithExercises;
  exercises: Exercise[];
  pending: boolean;
  start: Start;
  roomy?: boolean;
}) {
  const [picker, setPicker] = useState(false);
  // The exercise being swapped for another: this day, every workout to come.
  const [swapping, setSwapping] = useState<TemplateRow | null>(null);
  // Moves and removals show at once; the server catches up behind them, and
  // a failed one puts the list back (useAction says what didn't happen).
  const [rows, applyLocal] = useOptimistic(template.template_exercise, editRows);
  const slots = supersetSlots(rows, (r) => r.superset);
  const list = useRef<HTMLUListElement>(null);
  useListGlide(list, rows.map((r) => r.id).join());

  const setSets = (row: TemplateRow, raw: string) => {
    const val = parseInt(raw, 10);
    if (!Number.isNaN(val) && val !== row.target_sets)
      start(async () => {
        await updateTemplateExercise({ id: row.id, targetSets: val });
      });
  };
  const setReps = (row: TemplateRow, raw: string) => {
    const val = raw.trim();
    if (val !== (row.target_rep_range ?? ""))
      start(async () => {
        await updateTemplateExercise({ id: row.id, targetRepRange: val || null });
      });
  };
  const setRest = (row: TemplateRow, raw: string) =>
    start(async () => {
      await updateTemplateExercise({ id: row.id, restSeconds: raw ? Number(raw) : null });
    });
  const setNote = (row: TemplateRow, raw: string) => {
    const note = raw.trim();
    if (note !== (row.note ?? ""))
      start(async () => {
        await updateTemplateExercise({ id: row.id, note: note || null });
      });
  };
  const toggleSuperset = (row: TemplateRow, i: number) =>
    start(async () => {
      await setTemplateSuperset({ id: row.id, link: !slots[i] });
    });
  const move = (row: TemplateRow, direction: "up" | "down") =>
    start(async () => {
      applyLocal({ kind: "move", id: row.id, direction });
      await moveTemplateExercise({ id: row.id, direction });
    });
  const remove = (row: TemplateRow) =>
    start(async () => {
      applyLocal({ kind: "remove", id: row.id });
      await removeTemplateExercise({ id: row.id });
    });
  // Keeps its sets, reps, rest, cue and superset: only the movement changes.
  const swap = (row: TemplateRow, exercise: Exercise) =>
    start(async () => {
      applyLocal({ kind: "swap", id: row.id, exercise });
      await swapTemplateExercise({ id: row.id, newExerciseId: exercise.id });
    });

  const restOptions = (
    <>
      <option value="">Your usual rest</option>
      {REST_CHOICES.map((s) => (
        <option key={s} value={s}>
          {formatRestClock(s)} rest
        </option>
      ))}
    </>
  );
  const supersetLabel = (i: number) =>
    slots[i] ? "Take out of superset" : `Superset with ${rows[i + 1]?.exercise?.name ?? "the next"}`;

  return (
    <>
      <ul ref={list} className="divide-y divide-border">
        {rows.map((row, i) =>
          roomy ? (
            <li key={row.id} data-glide={row.id} className="px-6 py-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1 pt-1.5">
                  <p className="flex min-w-0 items-start gap-2">
                    {slots[i] && (
                      <span className="tnum mt-0.5 shrink-0 rounded bg-text/[0.08] px-1.5 text-[12px] font-semibold text-text">
                        {slotLabel(slots[i])}
                      </span>
                    )}
                    <span className="text-[17px] font-medium leading-snug text-text">
                      {row.exercise?.name ?? "Unknown"}
                    </span>
                  </p>
                  <p className="mt-0.5 truncate text-[13px] text-muted">
                    {row.exercise ? MUSCLE_LABEL[row.exercise.primary_muscle] : ""}
                  </p>
                </div>
                <div className="-mr-3 flex shrink-0 items-center">
                  <button
                    aria-label={`Swap ${row.exercise?.name ?? "exercise"} for another`}
                    title="Swap for another movement"
                    onClick={() => setSwapping(row)}
                    className="flex size-11 items-center justify-center rounded-full text-muted transition-colors hover:text-text"
                  >
                    <ArrowLeftRight className="size-[18px]" />
                  </button>
                  <button
                    disabled={i === 0}
                    aria-label={`Move ${row.exercise?.name ?? "exercise"} up`}
                    onClick={() => move(row, "up")}
                    className="flex size-11 items-center justify-center rounded-full text-muted transition-colors hover:text-text disabled:opacity-30"
                  >
                    <ChevronUp className="size-5" />
                  </button>
                  <button
                    disabled={i === rows.length - 1}
                    aria-label={`Move ${row.exercise?.name ?? "exercise"} down`}
                    onClick={() => move(row, "down")}
                    className="flex size-11 items-center justify-center rounded-full text-muted transition-colors hover:text-text disabled:opacity-30"
                  >
                    <ChevronDown className="size-5" />
                  </button>
                  <button
                    aria-label={`Remove ${row.exercise?.name ?? "exercise"}`}
                    onClick={() => remove(row)}
                    className="flex size-11 items-center justify-center rounded-full text-muted transition-colors hover:text-danger"
                  >
                    <X className="size-5" />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5">
                  <input
                    type="number"
                    inputMode="numeric"
                    onFocus={selectAllOnFocus}
                    min={1}
                    defaultValue={row.target_sets ?? 3}
                    aria-label={`Sets of ${row.exercise?.name ?? "this exercise"}`}
                    onBlur={(e) => setSets(row, e.target.value)}
                    className="tnum h-11 w-14 rounded-xl bg-surface-2 text-center text-[17px] text-text focus:outline-none focus:ring-2 focus:ring-text/25"
                  />
                  <span className="text-[13px] text-muted">×</span>
                  <input
                    type="text"
                    defaultValue={row.target_rep_range ?? ""}
                    aria-label={`Reps of ${row.exercise?.name ?? "this exercise"}`}
                    placeholder="8-12"
                    onBlur={(e) => setReps(row, e.target.value)}
                    className="tnum h-11 w-20 rounded-xl bg-surface-2 text-center text-[17px] text-text placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-text/25"
                  />
                </span>
                <label className="flex h-11 items-center gap-1.5 rounded-full bg-surface-2 pl-3.5 pr-1 text-[13px] text-muted">
                  <Timer aria-hidden className="size-3.5 shrink-0" />
                  <select
                    defaultValue={row.rest_seconds ?? ""}
                    aria-label={`Rest after ${row.exercise?.name ?? "this exercise"}`}
                    onChange={(e) => setRest(row, e.target.value)}
                    className="h-11 appearance-none rounded-full bg-transparent pr-2.5 text-[13px] text-text focus:outline-none"
                  >
                    {restOptions}
                  </select>
                </label>
                {(slots[i] || i < rows.length - 1) && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => toggleSuperset(row, i)}
                    className="flex h-11 min-w-0 max-w-full items-center gap-1.5 rounded-full bg-surface-2 px-3.5 text-[13px] text-muted transition-colors hover:text-text disabled:opacity-50"
                  >
                    {slots[i] ? <Unlink aria-hidden className="size-3.5 shrink-0" /> : <Link2 aria-hidden className="size-3.5 shrink-0" />}
                    <span className="truncate">{supersetLabel(i)}</span>
                  </button>
                )}
              </div>
              <input
                defaultValue={row.note ?? ""}
                aria-label={`Cue for ${row.exercise?.name ?? "this exercise"}`}
                placeholder="Add a cue, e.g. pause at the bottom"
                maxLength={200}
                onBlur={(e) => setNote(row, e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                className="mt-2 h-10 w-full rounded-xl bg-transparent px-3 -mx-3 text-[13px] text-text placeholder:text-muted/60 focus:bg-surface-2 focus:outline-none"
              />
            </li>
          ) : (
            <li
              key={row.id}
              data-glide={row.id}
              className="flex items-center gap-2 bg-surface px-3 py-2.5 sm:gap-3 sm:px-4"
            >
              <GripVertical className="hidden size-4 shrink-0 text-muted/50 sm:block" />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  {slots[i] && (
                    <span className="tnum shrink-0 rounded bg-text/[0.08] px-1 text-[11px] font-semibold text-text">
                      {slotLabel(slots[i])}
                    </span>
                  )}
                  {/* The name swaps it, as the logger's does. */}
                  <button
                    type="button"
                    onClick={() => setSwapping(row)}
                    aria-label={`Swap ${row.exercise?.name ?? "exercise"} for another`}
                    className="flex min-w-0 items-center gap-1 text-left text-sm text-text"
                  >
                    <span className="truncate">{row.exercise?.name ?? "Unknown"}</span>
                    <ArrowLeftRight aria-hidden className="size-3 shrink-0 text-muted" />
                  </button>
                </div>
                <div className="truncate text-xs text-muted">
                  {row.exercise
                    ? MUSCLE_LABEL[row.exercise.primary_muscle]
                    : ""}
                  {row.note ? `, ${row.note}` : ""}
                </div>
                {/* How long to rest after this one's sets, everywhere a
                    set is logged: the logger, the watch, Siri. A native
                    select, so iOS gives it its picker wheel. */}
                <label className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted">
                  <Timer aria-hidden className="size-3 shrink-0" />
                  <select
                    defaultValue={row.rest_seconds ?? ""}
                    aria-label={`Rest after ${row.exercise?.name ?? "this exercise"}`}
                    onChange={(e) => setRest(row, e.target.value)}
                    className="min-w-0 appearance-none truncate rounded bg-transparent text-xs text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-text/25"
                  >
                    {restOptions}
                  </select>
                </label>
                {/* Supersets: done back to back, resting after the round. */}
                {(slots[i] || i < rows.length - 1) && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => toggleSuperset(row, i)}
                    className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted transition-colors hover:text-text disabled:opacity-50"
                  >
                    {slots[i] ? <Unlink aria-hidden className="size-3 shrink-0" /> : <Link2 aria-hidden className="size-3 shrink-0" />}
                    <span className="truncate">{supersetLabel(i)}</span>
                  </button>
                )}
              </div>

              <input
                type="number"
                onFocus={selectAllOnFocus}
                min={1}
                defaultValue={row.target_sets ?? 3}
                aria-label="target sets"
                onBlur={(e) => setSets(row, e.target.value)}
                className="h-9 w-12 rounded-lg bg-surface-2 text-center tnum text-sm text-text focus:outline-none focus:ring-2 focus:ring-text/25"
              />
              <span className="text-xs text-muted">×</span>
              <input
                type="text"
                defaultValue={row.target_rep_range ?? ""}
                aria-label="target rep range"
                placeholder="8-12"
                onBlur={(e) => setReps(row, e.target.value)}
                className="h-9 w-16 rounded-lg bg-surface-2 text-center tnum text-sm text-text focus:outline-none focus:ring-2 focus:ring-text/25"
              />

              <div className="flex shrink-0 flex-col">
                <button
                  disabled={i === 0}
                  aria-label="Move up"
                  onClick={() => move(row, "up")}
                  className="flex h-[22px] w-7 items-center justify-center text-muted hover:text-text disabled:opacity-30"
                >
                  <ChevronUp className="size-4" />
                </button>
                <button
                  disabled={i === rows.length - 1}
                  aria-label="Move down"
                  onClick={() => move(row, "down")}
                  className="flex h-[22px] w-7 items-center justify-center text-muted hover:text-text disabled:opacity-30"
                >
                  <ChevronDown className="size-4" />
                </button>
              </div>
              <button
                aria-label="Remove exercise"
                onClick={() => remove(row)}
                className="hb-hit flex size-7 shrink-0 items-center justify-center text-muted transition-colors hover:text-danger"
              >
                <X className="size-4" />
              </button>
            </li>
          ),
        )}
        {rows.length === 0 && (
          <li className={cn("text-sm text-muted", roomy ? "px-6 py-6" : "px-4 py-4")}>
            No exercises yet.
          </li>
        )}
      </ul>
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2",
          roomy ? "border-t border-border px-6 py-4" : "p-3 sm:p-4",
        )}
      >
        <Button
          variant="outline"
          size={roomy ? "md" : "sm"}
          onClick={() => setPicker(true)}
        >
          <Plus className="size-4" />
          Add exercise
        </Button>
        <DeleteTemplate id={template.id} pending={pending} start={start} />
      </div>

      <ExercisePicker
        open={picker}
        onClose={() => setPicker(false)}
        exercises={exercises}
        onPick={(exerciseId) =>
          start(async () => {
            await addTemplateExercise({ templateId: template.id, exerciseId });
          })
        }
      />
      <ExercisePicker
        open={swapping !== null}
        onClose={() => setSwapping(null)}
        title={swapping?.exercise ? `Swap ${swapping.exercise.name}` : "Swap exercise"}
        hint="For this day from now on: every workout to come. Its sets, reps and rest stay."
        exercises={exercises.filter((e) => e.id !== swapping?.exercise_id)}
        onPick={(exerciseId) => {
          const row = swapping;
          const exercise = exercises.find((e) => e.id === exerciseId);
          if (row && exercise) swap(row, exercise);
        }}
      />
    </>
  );
}

/**
 * Deleting is in the template's editor, not on every row of the list: one
 * tap asks, the second deletes (as Programs does).
 */
function DeleteTemplate({ id, pending, start }: { id: string; pending: boolean; start: Start }) {
  const [asking, setAsking] = useState(false);
  return asking ? (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted">Delete this template?</span>
      <Button
        variant="danger"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await deleteTemplate({ id });
          })
        }
      >
        Delete
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setAsking(false)}>
        Cancel
      </Button>
    </div>
  ) : (
    <Button variant="ghost" size="sm" onClick={() => setAsking(true)} className="hover:text-danger">
      <Trash2 className="size-4" />
      Delete template
    </Button>
  );
}
