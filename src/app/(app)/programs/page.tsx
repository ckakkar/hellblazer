import { getPrograms, getActiveProgramProgress } from "@/lib/data/programs";
import { getTemplates } from "@/lib/data/templates";
import { PRESETS } from "@/lib/presets";
import { ProgramsManager } from "./programs-manager";

export const dynamic = "force-dynamic";

export default async function ProgramsPage() {
  const [programs, templates, activeProgress] = await Promise.all([
    getPrograms(),
    getTemplates(),
    getActiveProgramProgress(),
  ]);

  return (
    <ProgramsManager
      programs={programs}
      templates={templates}
      activeProgress={activeProgress}
      presets={PRESETS}
    />
  );
}
