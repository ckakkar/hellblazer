"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronDown, Loader2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ConfirmIconButton } from "@/components/ui/confirm-icon-button";
import { Sheet } from "@/components/ui/sheet";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import {
  MUSCLE_CHART_ORDER,
  MUSCLE_LABEL,
  MUSCLES,
  EQUIPMENT_OPTIONS,
  MECHANIC_OPTIONS,
  type Muscle,
} from "@/lib/muscles";
import type { Exercise } from "@/lib/data/exercises";
import { getExerciseGuide } from "@/lib/exercise-guides";
import {
  createCustomExercise,
  deleteCustomExercise,
} from "@/lib/actions/exercises";

export function ExercisesBrowser({ exercises }: { exercises: Exercise[] }) {
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState<string>("all");
  const [creating, setCreating] = useState(false);
  // One how-to open at a time, held here rather than per row so opening a
  // movement in one muscle group closes whatever was open in another.
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const groups = useMemo(() => {
    const s = q.trim().toLowerCase();
    const filtered = exercises.filter((e) => {
      if (muscle !== "all" && e.primary_muscle !== muscle) return false;
      if (!s) return true;
      return (
        e.name.toLowerCase().includes(s) ||
        MUSCLE_LABEL[e.primary_muscle].toLowerCase().includes(s)
      );
    });
    return MUSCLE_CHART_ORDER.map((m) => ({
      muscle: m,
      items: filtered.filter((e) => e.primary_muscle === m),
    })).filter((g) => g.items.length > 0);
  }, [exercises, q, muscle]);

  return (
    <div>
      <PageHeader
        title="Exercises"
        subtitle="The shared library plus your custom movements. Tap a movement to see how it's performed."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            New exercise
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search exercises…"
            className="pl-9"
          />
        </div>
        <Select
          value={muscle}
          onChange={(e) => setMuscle(e.target.value)}
          className="sm:w-52"
        >
          <option value="all">All muscles</option>
          {MUSCLE_CHART_ORDER.map((m) => (
            <option key={m} value={m}>
              {MUSCLE_LABEL[m]}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-5">
        {groups.map((g) => (
          <section key={g.muscle}>
            <h2 className="mb-2 px-1 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              {MUSCLE_LABEL[g.muscle]}
            </h2>
            <Card className="divide-y divide-border overflow-hidden">
              {g.items.map((e) => (
                <ExerciseRow
                  key={e.id}
                  exercise={e}
                  open={openId === e.id}
                  onToggle={() =>
                    setOpenId((cur) => (cur === e.id ? null : e.id))
                  }
                  deleting={pending}
                  onDelete={() =>
                    start(async () => {
                      await deleteCustomExercise({ id: e.id });
                    })
                  }
                />
              ))}
            </Card>
          </section>
        ))}
        {groups.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">
            No exercises match your search.
          </p>
        )}
      </div>

      <CreateExerciseSheet
        open={creating}
        onClose={() => setCreating(false)}
      />
    </div>
  );
}

/**
 * One library row, with its how-to as a disclosure underneath.
 *
 * The toggle is a button covering only the name and meta, never the whole row:
 * the delete control and the library badge sit outside it, since nesting
 * interactive elements inside a button is invalid and breaks keyboard use.
 * Movements with no guide (any custom exercise) render as plain, inert text
 * rather than a control that opens nothing.
 */
function ExerciseRow({
  exercise: e,
  open,
  onToggle,
  deleting,
  onDelete,
}: {
  exercise: Exercise;
  open: boolean;
  onToggle: () => void;
  deleting: boolean;
  onDelete: () => void;
}) {
  const guide = getExerciseGuide(e.name);
  const guideId = `guide-${e.id}`;

  const meta = (
    <>
      <div className="flex items-center gap-1.5">
        <span className="truncate text-sm text-text">{e.name}</span>
        {guide && (
          <ChevronDown
            className={cn(
              "size-3.5 shrink-0 text-muted transition-transform duration-200",
              open && "rotate-180 text-accent",
            )}
          />
        )}
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
        {e.mechanic && <span className="text-xs text-muted">{e.mechanic}</span>}
        {e.equipment && (
          <span className="text-xs text-muted">· {e.equipment}</span>
        )}
        {e.default_rep_range && (
          <span className="font-mono text-xs text-muted">
            · {e.default_rep_range}
          </span>
        )}
      </div>
    </>
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        {guide ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={guideId}
            className="-my-1 min-w-0 flex-1 rounded-lg py-1 text-left transition-colors hover:text-text"
          >
            {meta}
          </button>
        ) : (
          <div className="min-w-0 flex-1">{meta}</div>
        )}
        <div className="flex shrink-0 items-center gap-2">
          {e.secondary_muscles.length > 0 && (
            <span className="hidden text-xs text-muted sm:inline">
              {e.secondary_muscles.map((m) => MUSCLE_LABEL[m]).join(", ")}
            </span>
          )}
          {e.user_id ? (
            <ConfirmIconButton
              label="Delete exercise"
              confirmLabel="Tap again to delete exercise"
              disabled={deleting}
              onConfirm={onDelete}
            />
          ) : (
            <Badge variant="muted">library</Badge>
          )}
        </div>
      </div>
      {guide && open && (
        <div id={guideId} className="hb-reveal px-4 pb-4">
          <p className="border-l-2 border-accent/40 pl-3 text-sm leading-relaxed text-muted">
            {guide}
          </p>
        </div>
      )}
    </div>
  );
}

function CreateExerciseSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [primary, setPrimary] = useState<Muscle>("chest");
  const [secondary, setSecondary] = useState<Set<Muscle>>(new Set());
  const [mechanic, setMechanic] = useState<string>("");
  const [equipment, setEquipment] = useState<string>("");
  const [repRange, setRepRange] = useState("");

  function reset() {
    setName("");
    setPrimary("chest");
    setSecondary(new Set());
    setMechanic("");
    setEquipment("");
    setRepRange("");
  }

  function submit() {
    if (!name.trim()) return;
    start(async () => {
      await createCustomExercise({
        name: name.trim(),
        primaryMuscle: primary,
        secondaryMuscles: [...secondary],
        mechanic: (mechanic || null) as never,
        equipment: (equipment || null) as never,
        defaultRepRange: repRange.trim() || null,
      });
      reset();
      onClose();
    });
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="New custom exercise"
      footer={
        <Button
          onClick={submit}
          disabled={pending || !name.trim()}
          className="w-full"
          size="lg"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Create exercise
        </Button>
      }
    >
      <div className="grid gap-4 p-4">
        <Field label="Name">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Meadows Row"
          />
        </Field>
        <Field label="Primary muscle">
          <Select
            value={primary}
            onChange={(e) => setPrimary(e.target.value as Muscle)}
          >
            {MUSCLES.map((m) => (
              <option key={m} value={m}>
                {MUSCLE_LABEL[m]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Secondary muscles">
          <div className="flex flex-wrap gap-1.5">
            {MUSCLES.filter((m) => m !== primary).map((m) => {
              const active = secondary.has(m);
              return (
                <button
                  key={m}
                  onClick={() =>
                    setSecondary((prev) => {
                      const next = new Set(prev);
                      if (next.has(m)) next.delete(m);
                      else next.add(m);
                      return next;
                    })
                  }
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors",
                    active
                      ? "border-accent/40 bg-accent/10 text-accent"
                      : "border-border text-muted hover:text-text",
                  )}
                >
                  {MUSCLE_LABEL[m]}
                </button>
              );
            })}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mechanic">
            <Select
              value={mechanic}
              onChange={(e) => setMechanic(e.target.value)}
            >
              <option value="">-</option>
              {MECHANIC_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Equipment">
            <Select
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
            >
              <option value="">-</option>
              {EQUIPMENT_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Default rep range">
          <Input
            value={repRange}
            onChange={(e) => setRepRange(e.target.value)}
            placeholder="e.g. 8-12"
          />
        </Field>
      </div>
    </Sheet>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}
