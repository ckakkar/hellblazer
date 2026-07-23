"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { UNIT_COOKIE_NAME, ACCENT_COOKIE_NAME } from "@/lib/settings";
import { ACCENT_KEYS } from "@/lib/accents";

export async function setUnit(input: { unit: "kg" | "lb" }) {
  const { unit } = z.object({ unit: z.enum(["kg", "lb"]) }).parse(input);
  const store = await cookies();
  store.set(UNIT_COOKIE_NAME, unit, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}

export async function setAccent(input: { accent: string }) {
  const { accent } = z
    .object({ accent: z.enum(ACCENT_KEYS as [string, ...string[]]) })
    .parse(input);
  const store = await cookies();
  store.set(ACCENT_COOKIE_NAME, accent, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
