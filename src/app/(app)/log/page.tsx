import Link from "next/link";
import { getTemplates } from "@/lib/data/templates";
import { getActiveProgramProgress } from "@/lib/data/programs";
import { ProgramProgressCard } from "@/components/program/program-progress-card";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { SessionStarter } from "./session-starter";

export const dynamic = "force-dynamic";

export default async function LogPage() {
  const [templates, activeProgress] = await Promise.all([
    getTemplates(),
    getActiveProgramProgress(),
  ]);
  const options = templates.map((t) => ({
    id: t.id,
    name: t.name,
    day_label: t.day_label,
    count: t.template_exercise.length,
  }));
  const hasProgramNext = Boolean(activeProgress?.nextDay?.template_id);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Start a workout"
        subtitle="Jump into your program, a template, or go freeform."
      />

      {activeProgress && hasProgramNext && (
        <div className="mb-6">
          <ProgramProgressCard
            progress={activeProgress}
            href={`/programs/${activeProgress.program.id}`}
          />
        </div>
      )}

      {options.length === 0 && !activeProgress ? (
        <div className="grid gap-4">
          <SessionStarter templates={[]} />
          <EmptyState
            title="No program or templates yet"
            body="Build a split on Templates (or load the starter split) to train from a plan."
            action={
              <Link href="/programs">
                <Button variant="secondary">Go to Programs</Button>
              </Link>
            }
          />
        </div>
      ) : (
        <div>
          {hasProgramNext && (
            <div className="mb-3 px-1 text-xs font-medium uppercase tracking-wide text-muted">
              Or start something else
            </div>
          )}
          <SessionStarter templates={options} />
        </div>
      )}
    </div>
  );
}
