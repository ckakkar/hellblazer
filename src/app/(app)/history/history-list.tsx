"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { CalendarDays, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/page-header";
import { formatVolume, type Unit } from "@/lib/units";
import type { SessionSummary } from "@/lib/data/sessions";

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

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return sessions.filter((sess) => {
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
  }, [sessions, templateId, q]);

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays className="size-6" />}
        title="No sessions logged yet"
        body="Start a session from the Log tab and it'll show up here."
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by title or date…"
            className="pl-9"
          />
        </div>
        <Select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="sm:w-56"
        >
          <option value="all">All templates</option>
          <option value="freeform">Freeform only</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>

      {/* The full record. A history screen is a table you read down — the
          previous card-per-session layout made every row the same weight and
          buried the numbers you actually scan for. */}
      <div className="border-t border-border">
        {filtered.map((s) => (
          <Link
            key={s.session_id}
            href={
              s.finished_at
                ? `/history/${s.session_id}`
                : `/log/${s.session_id}`
            }
            className="group flex items-baseline gap-3 border-b border-border py-3 transition-colors hover:bg-surface/60"
          >
            <span className="w-14 shrink-0 font-mono text-[11px] uppercase tabular-nums text-muted">
              {s.session_date
                ? format(parseISO(s.session_date), "dd MMM")
                : "--"}
            </span>
            <span className="flex min-w-0 flex-1 items-baseline gap-2">
              <span className="truncate font-display text-[15px] uppercase tracking-wide text-text transition-colors group-hover:text-accent">
                {s.title ?? "Session"}
              </span>
              {!s.finished_at && <Badge variant="accent">Live</Badge>}
              {!s.template_id && <Badge variant="muted">freeform</Badge>}
            </span>
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted">
              {s.working_sets ?? 0} sets
            </span>
            <span className="hidden w-20 shrink-0 text-right font-mono text-[11px] tabular-nums text-text sm:inline">
              {formatVolume(Number(s.total_volume ?? 0), unit)}
            </span>
            <span className="hidden w-12 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted md:inline">
              {s.duration_min ? `${s.duration_min}m` : "—"}
            </span>
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">
            No sessions match your filters.
          </p>
        )}
      </div>
    </div>
  );
}
