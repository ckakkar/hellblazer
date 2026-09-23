"use client";

import { useMemo, useState, ViewTransition } from "react";
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
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by title or date"
            className="pl-10"
          />
        </div>
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
                <Link
                  key={s.session_id}
                  href={s.finished_at ? `/history/${s.session_id}` : `/log/${s.session_id}`}
                  transitionTypes={["nav-forward"]}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.03] active:bg-white/[0.05]"
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
              ))}
            </div>
          </section>
        ))}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-[15px] text-muted">No sessions match your filters.</p>
        )}
      </div>
    </div>
  );
}
