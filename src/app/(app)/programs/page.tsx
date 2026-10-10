import type { Metadata } from "next";
import { getPrograms, getActiveProgramProgress } from "@/lib/data/programs";
import { getTemplates } from "@/lib/data/templates";
import { getActiveSession } from "@/lib/data/sessions";
import { PRESETS } from "@/lib/presets";
import { ProgramsManager } from "./programs-manager";

export const metadata: Metadata = { title: "Programs" };

export const dynamic = "force-dynamic";

export default async function ProgramsPage() {
  const [programs, templates, activeProgress, activeSession] = await Promise.all([
    getPrograms(),
    getTemplates(),
    getActiveProgramProgress(),
    getActiveSession(),
  ]);

  return (
    <ProgramsManager
      programs={programs}
      templates={templates}
      activeProgress={activeProgress}
      activeSession={activeSession}
      presets={PRESETS}
    />
  );
}
