import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import type { Exercise } from "@/lib/data/exercises";

export type WorkoutTemplate =
  Database["public"]["Tables"]["workout_template"]["Row"];
export type TemplateExercise =
  Database["public"]["Tables"]["template_exercise"]["Row"];

export type TemplateExerciseWithExercise = TemplateExercise & {
  exercise: Exercise | null;
};

export type TemplateWithExercises = WorkoutTemplate & {
  template_exercise: TemplateExerciseWithExercise[];
};

const TEMPLATE_SELECT = "*, template_exercise(*, exercise(*))";

export async function getTemplates(): Promise<TemplateWithExercises[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_template")
    .select(TEMPLATE_SELECT)
    .order("position", { ascending: true })
    .order("position", {
      ascending: true,
      referencedTable: "template_exercise",
    });
  if (error) throw error;
  return (data ?? []) as TemplateWithExercises[];
}

export async function getTemplate(
  id: string,
): Promise<TemplateWithExercises | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_template")
    .select(TEMPLATE_SELECT)
    .eq("id", id)
    .order("position", {
      ascending: true,
      referencedTable: "template_exercise",
    })
    .maybeSingle();
  if (error) throw error;
  return (data as TemplateWithExercises | null) ?? null;
}
