import { getTemplates } from "@/lib/data/templates";
import { getExercises } from "@/lib/data/exercises";
import { PRESETS } from "@/lib/presets";
import { TemplatesManager } from "./templates-manager";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const [templates, exercises] = await Promise.all([
    getTemplates(),
    getExercises(),
  ]);

  return (
    <TemplatesManager
      templates={templates}
      exercises={exercises}
      presets={PRESETS}
    />
  );
}
