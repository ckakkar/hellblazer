"use client";

import { useCallback, useEffect, useMemo, useRef, useState, ViewTransition } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import { SearchField } from "@/components/ui/search-field";
import { SwipeRow } from "@/components/ui/swipe-row";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/page-header";
import { formatVolume, type Unit } from "@/lib/units";
import type { SessionSummary } from "@/lib/data/sessions";
import { discardSession } from "@/lib/actions/sessions";

/** How long Undo stays up before a swiped-away workout is really deleted. */
const UNDO_MS = 5000;

type TemplateOption = { id: string; name: string };

export function HistoryList({
  sessions,
  templates,
  unit,
}: {
  sessions: SessionSummary[];
  templates: TemplateOption[];
  unit: Unit;
}) {
  const [templateId, setTemplateId] = useState("all");
  const [q, setQ] = useState("");

  // Swipe to delete, as in Mail: the row goes at once, and it's only deleted
  // for real once Undo has had its few seconds.
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<{ id: string; title: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef(pending);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  const commit = useCallback((p: { id: string }) => {
    discardSession({ id: p.id }).catch(() => {
      setHidden((prev) => {
        const next = new Set(prev);
        next.delete(p.id);
        return next;
      });
      setFailed(true);
    });
  }, []);

  function remove(s: SessionSummary) {
    if (!s.session_id) return;
    // A second delete settles the first.
    if (timer.current) clearTimeout(timer.current);
    if (pendingRef.current) commit(pendingRef.current);
    const p = { id: s.session_id, title: s.title ?? "Session" };
    setHidden((prev) => new Set(prev).add(p.id));
    setPending(p);
    setFailed(false);
    timer.current = setTimeout(() => {
      timer.current = null;
      commit(p);
      setPending(null);
    }, UNDO_MS);
  }

  function undo() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const p = pendingRef.current;
    if (p) {
      setHidden((prev) => {
        const next = new Set(prev);
        next.delete(p.id);
        return next;
      });
    }
    setPending(null);
  }

  // Leaving the page doesn't cancel a delete that was asked for.
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        if (pendingRef.current) commit(pendingRef.current);
      }
    },
    [commit],
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return sessions.filter((sess) => {
      if (sess.session_id && hidden.has(sess.session_id)) return false;
      if (templateId === "all") {
        // no-op
      } else if (templateId === "freeform") {
        if (sess.template_id) return false;
      } else if (sess.template_id !== templateId) {
        return false;
      }
      if (!s) return true;
      return (
        (sess.title ?? "").toLowerCase().includes(s) ||
        (sess.session_date ?? "").includes(s)
      );
    });
  }, [sessions, templateId, q, hidden]);

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays className="size-6" />}
        title="No sessions logged yet"
        body="Start a session from the Log tab and it'll show up here."
      />
    );
  }

  // Month sections: a long record reads by month, the way you remember it.
  const months: { key: string; label: string; rows: SessionSummary[] }[] = [];
  for (const s of filtered) {
    const d = s.session_date ? parseISO(s.session_date) : null;
    const key = d ? format(d, "yyyy-MM") : "undated";
    const label = d ? format(d, "MMMM yyyy") : "No date";
    const last = months[months.length - 1];
    if (last?.key === key) last.rows.push(s);
    else months.push({ key, label, rows: [s] });
  }

  return (
    <div>
      <div className="mb-8 flex flex-col gap-2 sm:flex-row">
        <SearchField
          value={q}
          onValueChange={setQ}
          placeholder="Search by title or date"
          className="flex-1"
        />
        <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="sm:w-56">
          <option value="all">All templates</option>
          <option value="freeform">Freeform only</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-8">
        {months.map((m) => (
          <section key={m.key}>
            <h2 className="mb-2 px-4 text-[13px] font-medium text-muted">{m.label}</h2>
            <div className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl bg-surface">
              {m.rows.map((s) => (
                <SwipeRow key={s.session_id} onAction={() => remove(s)}>
                <Link
                  href={s.finished_at ? `/history/${s.session_id}` : `/log/${s.session_id}`}
                  transitionTypes={["nav-forward"]}
                  className="flex items-center gap-3 bg-surface px-4 py-3.5 transition-colors hover:bg-surface-2 active:bg-surface-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <ViewTransition name={`session-${s.session_id}`} share="hb-morph" default="none">
                        <span className="truncate text-[15px] font-medium text-text">
                          {s.title ?? "Session"}
                        </span>
                      </ViewTransition>
                      {!s.finished_at && <Badge variant="accent">Live</Badge>}
                    </div>
                    <p className="tnum mt-0.5 text-[13px] text-muted">
                      {s.session_date ? format(parseISO(s.session_date), "EEE d") : "No date"}
                      {s.duration_min ? `, ${s.duration_min} min` : ""}
                      {!s.template_id ? ", freeform" : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tnum text-[15px] text-text">
                      {formatVolume(Number(s.total_volume ?? 0), unit)}
                    </p>
                    <p className="tnum mt-0.5 text-[13px] text-muted">{s.working_sets ?? 0} sets</p>
                  </div>
                </Link>
                </SwipeRow>
              ))}
            </div>
          </section>
        ))}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-[15px] text-muted">No sessions match your filters.</p>
        )}
      </div>

      {(pending || failed) && (
        <div
          role="status"
          className="hb-glass fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] z-40 flex items-center gap-3 rounded-2xl py-2.5 pl-4 pr-2 min-[400px]:inset-x-5 md:inset-x-auto md:bottom-6 md:right-6 md:w-96"
        >
          <span className="min-w-0 flex-1 truncate text-[15px] text-text">
            {failed ? "Couldn't delete that workout, so it's back." : `Deleted “${pending?.title}”`}
          </span>
          {failed ? (
            <button
              type="button"
              onClick={() => setFailed(false)}
              className="rounded-xl px-3 py-1.5 text-[15px] font-semibold text-text"
            >
              OK
            </button>
          ) : (
            <button
              type="button"
              onClick={undo}
              className="rounded-xl px-3 py-1.5 text-[15px] font-semibold text-text"
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
