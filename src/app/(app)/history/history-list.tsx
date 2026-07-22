"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { CalendarDays, ChevronRight, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
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

      <div className="grid gap-3">
        {filtered.map((s) => (
          <Link
            key={s.session_id}
            href={
              s.finished_at
                ? `/history/${s.session_id}`
                : `/log/${s.session_id}`
            }
          >
            <Card className="flex items-center gap-4 p-4 transition-[transform,border-color] hover:border-accent/40 active:scale-[0.99] active:border-accent/40">
              <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-lg bg-surface-2 font-mono">
                <span className="text-[10px] uppercase text-muted">
                  {s.session_date
                    ? format(parseISO(s.session_date), "MMM")
                    : ""}
                </span>
                <span className="text-sm font-semibold text-text">
                  {s.session_date ? format(parseISO(s.session_date), "d") : ""}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-text">
                    {s.title ?? "Session"}
                  </span>
                  {!s.finished_at && (
                    <Badge variant="accent">In progress</Badge>
                  )}
                  {!s.template_id && <Badge variant="muted">freeform</Badge>}
                </div>
                <div className="mt-0.5 font-mono text-xs text-muted">
                  {s.working_sets ?? 0} sets ·{" "}
                  {formatVolume(Number(s.total_volume ?? 0), unit)}
                  {s.duration_min ? ` · ${s.duration_min}min` : ""}
                </div>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted" />
            </Card>
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
