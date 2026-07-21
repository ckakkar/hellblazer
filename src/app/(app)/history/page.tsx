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
        subtitle="Every logged session, most recent first."
      />
      <HistoryList
        sessions={sessions}
        templates={templates.map((t) => ({ id: t.id, name: t.name }))}
        unit={unit}
      />
    </div>
  );
}
