"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LIFT_NOTE_MAX, failureCode, saveLiftNoteNow } from "@/lib/logger-sync";
import { reportProblem } from "@/lib/report";
import type { LiftNotes } from "@/lib/data/lift-notes";
import { dropUnsentNote, keepUnsentNote, readUnsentNotes } from "@/lib/unsent-notes";

/**
 * The page's lift notes: what each says, and which didn't save. Held by the
 * page, not by a note on screen, so closing the sheet a note was written in
 * doesn't forget that it didn't save (or offer to save it again). Each note
 * is kept on the device until the server has it (unsent-notes.ts), so one
 * that didn't save survives leaving the page: the next page that shows
 * notes puts it back and sends it again. It also goes again when the
 * connection comes back.
 */
export function useLiftNotes(initial: LiftNotes, userId: string) {
  const [notes, setNotes] = useState<LiftNotes>(initial);
  // Exercise ids whose latest note the server doesn't have.
  const [unsaved, setUnsaved] = useState<ReadonlySet<string>>(new Set());
  const sent = useRef(new Map<string, number>());
  const latest = useRef(notes);

  const save = useCallback((exerciseId: string, note: string | null) => {
    const n = (sent.current.get(exerciseId) ?? 0) + 1;
    sent.current.set(exerciseId, n);
    const next = { ...latest.current };
    if (note) next[exerciseId] = note;
    else delete next[exerciseId];
    latest.current = next;
    setNotes(next);
    const mark = (failed: boolean) =>
      setUnsaved((cur) => {
        if (cur.has(exerciseId) === failed) return cur;
        const out = new Set(cur);
        if (failed) out.add(exerciseId);
        else out.delete(exerciseId);
        return out;
      });
    mark(false);
    const kept = keepUnsentNote(userId, exerciseId, note);
    saveLiftNoteNow(exerciseId, note, userId).then(
      () => {
        dropUnsentNote(userId, exerciseId, kept);
        if (sent.current.get(exerciseId) === n) mark(false);
      },
      (err: unknown) => {
        if (sent.current.get(exerciseId) !== n) return;
        mark(true);
        reportProblem("note-save-failed", failureCode(err));
      },
    );
  }, [userId]);

  // Notes this device kept that the server never got: back on screen, and
  // sent again (once, now; then with the connection).
  useEffect(() => {
    const kept = readUnsentNotes(userId);
    for (const [id, note] of Object.entries(kept)) save(id, note);
  }, [userId, save]);

  useEffect(() => {
    if (unsaved.size === 0) return;
    const again = () => {
      for (const id of unsaved) save(id, latest.current[id] ?? null);
    };
    window.addEventListener("online", again);
    return () => window.removeEventListener("online", again);
  }, [unsaved, save]);

  return { notes, unsaved, save };
}

/**
 * The lifter's own note on a movement ("Seat 4, pin 7"), kept with the
 * exercise rather than the workout, so it's there whenever that movement
 * comes up, an empty start included. Tap it to change it; clearing it
 * removes it. Shown at once; if the save didn't land it says so, here and
 * wherever else the note shows, and offers to send it again.
 */
export function LiftNote({
  exerciseId,
  exerciseName,
  note,
  unsaved,
  onSave,
  className,
}: {
  exerciseId: string;
  exerciseName: string;
  note: string | null;
  /** The server doesn't have this note (or its removal) yet. */
  unsaved: boolean;
  onSave: (exerciseId: string, note: string | null) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const open = useRef(false);
  const refocus = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);

  // Back on the note (or "Add a note") after Enter or Escape, not lost to
  // the page; a tap elsewhere keeps the focus where it went.
  useEffect(() => {
    if (!editing && refocus.current) {
      refocus.current = false;
      trigger.current?.focus();
    }
  }, [editing]);

  const begin = () => {
    open.current = true;
    setDraft(note ?? "");
    setEditing(true);
  };

  // Enter, Save and a tap away all end here; only the first counts. The same
  // words again still go when the last copy didn't save.
  const commit = () => {
    if (!open.current) return;
    open.current = false;
    setEditing(false);
    const next = draft.trim().slice(0, LIFT_NOTE_MAX).trim() || null;
    if (next !== note || unsaved) onSave(exerciseId, next);
  };

  if (editing) {
    return (
      <form
        className={`flex items-center gap-2 ${className ?? ""}`}
        onSubmit={(e) => {
          e.preventDefault();
          refocus.current = true;
          commit();
        }}
      >
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key !== "Escape") return;
            e.preventDefault();
            e.stopPropagation();
            open.current = false;
            refocus.current = true;
            setEditing(false);
          }}
          maxLength={LIFT_NOTE_MAX}
          enterKeyHint="done"
          autoComplete="off"
          placeholder="Seat height, pin, grip"
          aria-label={`Your note on ${exerciseName}`}
        />
        {/* Pressing Save mustn't blur the field first (that would save, then
            the press would land on nothing). */}
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          className="hb-hit shrink-0"
          onPointerDown={(e) => e.preventDefault()}
        >
          Save
        </Button>
      </form>
    );
  }

  return (
    <div className={className}>
      {note ? (
        <button
          ref={trigger}
          type="button"
          onClick={begin}
          className="hb-hit -mx-1 flex w-[calc(100%+0.5rem)] items-start gap-2 rounded-lg px-1 py-1 text-left transition-opacity active:opacity-60"
        >
          <NotebookPen aria-hidden className="mt-[3px] size-3.5 shrink-0 text-muted" />
          <span className="min-w-0 flex-1 text-[14px] leading-snug text-text [overflow-wrap:anywhere]">{note}</span>
          <span className="sr-only">, your note. Edit it</span>
        </button>
      ) : (
        <button
          ref={trigger}
          type="button"
          onClick={begin}
          aria-label={`Add a note on ${exerciseName}`}
          className="hb-hit inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-text active:text-text"
        >
          <NotebookPen aria-hidden className="size-3.5" />
          Add a note
        </button>
      )}
      <div role="status">
        {unsaved && (
          <p className="mt-1 text-[13px] text-muted">
            {note ? "Your note didn't save." : "Your note wasn't removed."}{" "}
            <button
              type="button"
              onClick={() => onSave(exerciseId, note)}
              className="hb-hit text-text underline decoration-text/30 underline-offset-2"
            >
              Try again
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
