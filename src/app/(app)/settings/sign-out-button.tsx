"use client";

import { LogOut } from "lucide-react";
import { signOutOfApp } from "@/lib/sign-out";

export function SignOutButton() {
  return (
    <form action={signOutOfApp}>
      <button
        type="submit"
        className="inline-flex h-9 items-center gap-2 rounded-xl bg-danger/10 px-3.5 text-[14px] font-medium text-danger transition-colors hover:bg-danger/15"
      >
        <LogOut className="size-4" />
        Sign out
      </button>
    </form>
  );
}
