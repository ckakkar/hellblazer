"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Flame } from "lucide-react";
import { isNativeApp } from "@/lib/native";

const noop = () => () => {};

/**
 * Top of the Privacy and Support pages. On the website, the brand, linking
 * home. In the iOS app these pages are pushed from Settings (or the sign-in
 * screen), so they get a back button like any pushed screen.
 */
export function LegalBack() {
  const router = useRouter();
  const inApp = useSyncExternalStore(noop, isNativeApp, () => false);
  if (inApp) {
    return (
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
        className="-ml-2 flex h-11 items-center pr-3 text-[17px] text-text active:opacity-60"
      >
        <ChevronLeft className="-mr-0.5 size-7" strokeWidth={2.25} />
        Back
      </button>
    );
  }
  return (
    <Link href="/" className="inline-flex items-center gap-2 text-text">
      <Flame className="size-5 text-accent" strokeWidth={2.25} />
      <span className="text-[15px] font-semibold tracking-[-0.02em]">Fatty</span>
    </Link>
  );
}
