import Link from "next/link";
import { getTemplates } from "@/lib/data/templates";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { SessionStarter } from "./session-starter";

export const dynamic = "force-dynamic";

export default async function LogPage() {
  const templates = await getTemplates();
  const options = templates.map((t) => ({
    id: t.id,
    name: t.name,
    day_label: t.day_label,
    count: t.template_exercise.length,
  }));

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Start a session"
        subtitle="Instantiate a template, or go freeform."
      />
      {options.length === 0 ? (
        <div className="grid gap-4">
          <SessionStarter templates={[]} />
          <EmptyState
            title="No templates yet"
            body="Build a split on the Templates page to start sessions from it."
            action={
              <Link href="/templates">
                <Button variant="secondary">Go to Templates</Button>
              </Link>
            }
          />
        </div>
      ) : (
        <SessionStarter templates={options} />
      )}
    </div>
  );
}
