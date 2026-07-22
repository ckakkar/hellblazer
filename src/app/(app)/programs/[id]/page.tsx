import { notFound } from "next/navigation";
import { getProgram, getProgramProgress } from "@/lib/data/programs";
import { getTemplates } from "@/lib/data/templates";
import { ProgramDetail } from "./program-detail";

export const dynamic = "force-dynamic";

export default async function ProgramDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [program, templates] = await Promise.all([
    getProgram(id),
    getTemplates(),
  ]);
  if (!program) notFound();

  const progress = await getProgramProgress(program);

  return (
    <ProgramDetail
      program={program}
      progress={progress}
      templates={templates}
    />
  );
}
