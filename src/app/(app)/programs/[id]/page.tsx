import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProgram, getProgramProgress } from "@/lib/data/programs";
import { getTemplates } from "@/lib/data/templates";
import { getExercises } from "@/lib/data/exercises";
import { getActiveSession } from "@/lib/data/sessions";
import { ProgramDetail } from "./program-detail";

export const metadata: Metadata = { title: "Program" };

export const dynamic = "force-dynamic";

export default async function ProgramDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [program, templates, exercises, activeSession] = await Promise.all([
    getProgram(id),
    getTemplates(),
    getExercises(),
    getActiveSession(),
  ]);
  if (!program) notFound();

  const progress = await getProgramProgress(program);

  return (
    <ProgramDetail
      program={program}
      progress={progress}
      activeSession={activeSession}
      templates={templates}
      exercises={exercises}
    />
  );
}
