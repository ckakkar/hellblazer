import { getSessionSummaries } from "@/lib/data/sessions";
import { getTemplates } from "@/lib/data/templates";
import { getUnit } from "@/lib/settings";
import { PageHeader } from "@/components/ui/page-header";
import { HistoryList } from "./history-list";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const [sessions, templates, unit] = await Promise.all([
    getSessionSummaries(),
    getTemplates(),
    getUnit(),
  ]);

  return (
    <div>
      <PageHeader
        title="History"
        subtitle="Every completed bout, every working set, and every number that put your name on the card."
        eyebrow="Official fight ledger"
        index="07"
        stat={{
          value: sessions.length,
          label: sessions.length === 1 ? "bout" : "bouts",
        }}
      />
      <HistoryList
        sessions={sessions}
        templates={templates.map((t) => ({ id: t.id, name: t.name }))}
        unit={unit}
      />
    </div>
  );
}
