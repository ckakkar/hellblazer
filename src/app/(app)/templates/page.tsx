import { getTemplates } from "@/lib/data/templates";
import { getExercises } from "@/lib/data/exercises";
import { getActiveProgramProgress } from "@/lib/data/programs";
import { PRESETS } from "@/lib/presets";
import { TemplatesManager } from "./templates-manager";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const [templates, exercises, active] = await Promise.all([
    getTemplates(),
    getExercises(),
    getActiveProgramProgress(),
  ]);

  // The active program is "your split" — its day-templates, in order.
  const activeTemplateIds: string[] = [];
  if (active) {
    for (const d of active.program.program_day) {
      if (d.template_id && !activeTemplateIds.includes(d.template_id)) {
        activeTemplateIds.push(d.template_id);
      }
    }
  }

  return (
    <TemplatesManager
      templates={templates}
      exercises={exercises}
      presets={PRESETS}
      activeTemplateIds={activeTemplateIds}
      activeProgramName={active?.program.name ?? null}
    />
  );
}
