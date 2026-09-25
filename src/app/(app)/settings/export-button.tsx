"use client";

import { useState, useSyncExternalStore } from "react";
import { Download, Loader2 } from "lucide-react";
import { isNativeApp } from "@/lib/native";

const noop = () => () => {};
const buttonClass =
  "inline-flex h-9 items-center gap-2 rounded-xl bg-surface-2 px-3.5 text-[14px] font-medium text-text transition-colors hover:bg-[#242428] disabled:opacity-60";

/**
 * Every logged set as a CSV. The website downloads it; the iOS app can't
 * download files from a web view, so it hands the file to the share sheet
 * instead (Save to Files, AirDrop, Mail).
 */
export function ExportButton() {
  const inApp = useSyncExternalStore(noop, isNativeApp, () => false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!inApp) {
    return (
      <a href="/api/export" download className={buttonClass}>
        <Download className="size-4" />
        Export
      </a>
    );
  }

  async function share() {
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch("/api/export");
      if (!res.ok) throw new Error("export failed");
      const { shareNatively } = await import("@/lib/native-plugins");
      await shareNatively(await res.blob(), "fatty-sets.csv");
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={share} disabled={busy} className={buttonClass}>
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
      {failed ? "Try again" : "Export"}
    </button>
  );
}
