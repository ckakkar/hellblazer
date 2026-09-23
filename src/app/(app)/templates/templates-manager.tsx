"use client";

import { useState, useTransition } from "react";
import {
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Eraser,
  GripVertical,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ConfirmIconButton } from "@/components/ui/confirm-icon-button";
import { ExercisePicker } from "@/components/exercise-picker";
import { PageHeader, EmptyState, SectionLabel } from "@/components/ui/page-header";
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
  updateTemplateExercise,
} from "@/lib/actions/templates";
import { selectAllOnFocus } from "@/lib/utils";

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
  const [pending, start] = useTransition();
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showOthers, setShowOthers] = useState(false);

  // "Your split" = the active program's days, in order. Everything else is
  // shown separately so a page full of old loads doesn't drown the current one.
  const byId = new Map(templates.map((t) => [t.id, t]));
  const currentSplit = activeTemplateIds
    .map((id) => byId.get(id))
    .filter((t): t is TemplateWithExercises => Boolean(t));
  const currentIds = new Set(currentSplit.map((t) => t.id));
  const otherTemplates = templates.filter((t) => !currentIds.has(t.id));

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
          <div className="grid gap-3">
            {currentSplit.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                exercises={exercises}
                pending={pending}
                start={start}
              />
            ))}
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
                <div className="mt-3 grid gap-3">
                  {otherTemplates.map((t) => (
                    <TemplateCard
                      key={t.id}
                      template={t}
                      exercises={exercises}
                      pending={pending}
                      start={start}
                    />
                  ))}
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
          <div className="grid gap-3">
            {otherTemplates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                exercises={exercises}
                pending={pending}
                start={start}
              />
            ))}
          </div>
        </>
      )}

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
          await cleanupTemplates();
        })
      }
      title="Delete leftover templates you've never trained and aren't in a program"
      className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-[13px] text-muted transition-colors hover:text-text disabled:opacity-45"
    >
      <Eraser className="size-3.5" />
      Clean up
    </button>
  );
}

function TemplateCard({
  template,
  exercises,
  pending,
  start,
}: {
  template: TemplateWithExercises;
  exercises: Exercise[];
  pending: boolean;
  start: (fn: () => Promise<void>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [picker, setPicker] = useState(false);
  const rows = template.template_exercise;

  return (
    <Card>
      <div className="flex items-center gap-3 p-4">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
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
        <ConfirmIconButton
          label="Delete template"
          confirmLabel="Tap again to delete template"
          disabled={pending}
          onConfirm={() =>
            start(async () => {
              await deleteTemplate({ id: template.id });
            })
          }
        />
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex size-8 shrink-0 items-center justify-center text-muted transition-colors hover:text-text"
          aria-expanded={open}
          aria-label={open ? "Collapse" : "Expand"}
        >
          {open ? (
            <ChevronUp className="size-5" />
          ) : (
            <ChevronDown className="size-5" />
          )}
        </button>
      </div>

      {open && (
        <div className="border-t border-border">
          <ul className="divide-y divide-border">
            {rows.map((row, i) => (
              <li
                key={row.id}
                className="flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4"
              >
                <GripVertical className="hidden size-4 shrink-0 text-muted/50 sm:block" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-text">
                    {row.exercise?.name ?? "Unknown"}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {row.exercise
                      ? MUSCLE_LABEL[row.exercise.primary_muscle]
                      : ""}
                    {row.note ? `, ${row.note}` : ""}
                  </div>
                </div>

                <input
                  type="number"
                  onFocus={selectAllOnFocus}
                  min={1}
                  defaultValue={row.target_sets ?? 3}
                  aria-label="target sets"
                  onBlur={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!Number.isNaN(val) && val !== row.target_sets)
                      start(async () => {
                        await updateTemplateExercise({
                          id: row.id,
                          targetSets: val,
                        });
                      });
                  }}
                  className="h-9 w-12 rounded-lg bg-surface-2 text-center tnum text-sm text-text focus:outline-none focus:ring-2 focus:ring-text/25"
                />
                <span className="text-xs text-muted">×</span>
                <input
                  type="text"
                  defaultValue={row.target_rep_range ?? ""}
                  aria-label="target rep range"
                  placeholder="8-12"
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    if (val !== (row.target_rep_range ?? ""))
                      start(async () => {
                        await updateTemplateExercise({
                          id: row.id,
                          targetRepRange: val || null,
                        });
                      });
                  }}
                  className="h-9 w-16 rounded-lg bg-surface-2 text-center tnum text-sm text-text focus:outline-none focus:ring-2 focus:ring-text/25"
                />

                <div className="flex shrink-0 flex-col">
                  <button
                    disabled={i === 0 || pending}
                    aria-label="Move up"
                    onClick={() =>
                      start(async () => {
                        await moveTemplateExercise({
                          id: row.id,
                          direction: "up",
                        });
                      })
                    }
                    className="text-muted hover:text-text disabled:opacity-30"
                  >
                    <ChevronUp className="size-4" />
                  </button>
                  <button
                    disabled={i === rows.length - 1 || pending}
                    aria-label="Move down"
                    onClick={() =>
                      start(async () => {
                        await moveTemplateExercise({
                          id: row.id,
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
                  aria-label="Remove exercise"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await removeTemplateExercise({ id: row.id });
                    })
                  }
                  className="shrink-0 text-muted transition-colors hover:text-danger"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
            {rows.length === 0 && (
              <li className="px-4 py-4 text-sm text-muted">
                No exercises yet.
              </li>
            )}
          </ul>
          <div className="p-3 sm:p-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPicker(true)}
            >
              <Plus className="size-4" />
              Add exercise
            </Button>
          </div>
        </div>
      )}

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
    </Card>
  );
}
