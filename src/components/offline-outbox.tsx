"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { CloudOff, Loader2 } from "lucide-react";
import { drainOutbox, getOutbox, getServerOutbox, subscribeOutbox } from "@/lib/offline-outbox";
import { useDeviceName } from "@/lib/device";
import { isNativeApp } from "@/lib/native";

const never = () => () => {};

/** The workout open on screen, whose logger uploads its own sets. */
const openSession = (path: string) => path.match(/^\/log\/([0-9a-f-]{36})/)?.[1] ?? null;

/**
 * Uploads sets left on this device from anywhere in the app (offline-outbox.ts):
 * on opening, on reconnecting, on coming back to the screen, and on moving
 * between pages. Renders nothing; Home says when something's waiting.
 */
export function OfflineOutbox({ userId }: { userId: string }) {
  const path = usePathname();
  useEffect(() => {
    const open = openSession(path);
    const drain = () => void drainOutbox(userId, open);
    const onVisible = () => {
      if (document.visibilityState === "visible") drain();
    };
    drain();
    window.addEventListener("online", drain);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", drain);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId, path]);
  return null;
}

/** Home's line about sets still on this device, only while there are some. */
export function OutboxNote() {
  const { waiting, sending } = useSyncExternalStore(subscribeOutbox, getOutbox, getServerOutbox);
  const name = useDeviceName();
  const device = useSyncExternalStore(never, isNativeApp, () => false) ? name : "device";
  if (waiting === 0) return null;
  const sets = `${waiting} ${waiting === 1 ? "set" : "sets"}`;
  return (
    <p role="status" className="flex items-center gap-2 px-1 text-[13px] text-muted">
      {sending ? <Loader2 className="size-3.5 shrink-0 animate-spin" /> : <CloudOff className="size-3.5 shrink-0" />}
      {sending
        ? `Uploading ${sets} saved on this ${device}.`
        : `${sets} saved on this ${device}, waiting for a connection to upload.`}
    </p>
  );
}
