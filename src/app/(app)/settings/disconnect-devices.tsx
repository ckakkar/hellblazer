"use client";

import { useEffect, useState } from "react";
import { Loader2, Unplug } from "lucide-react";
import { unlinkAllDevices } from "@/lib/actions/watch";
import { useAction } from "@/lib/use-action";
import { showNotice } from "@/lib/notice";
import { cn } from "@/lib/utils";
import { nativePlugin } from "@/lib/native-plugins";

/**
 * Revokes every Apple Watch and phone link on the account at once, for a lost
 * device. Asked twice (the second tap within a few seconds). In the app, this
 * iPhone and its watch then let go of their old links and the page reloads,
 * so DeviceSync links them again straight away; elsewhere, the app does that
 * the next time it opens.
 */
export function DisconnectDevices() {
  const [pending, start] = useAction("disconnect your devices");
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        start(async () => {
          await unlinkAllDevices();
          const plugin = nativePlugin();
          if (plugin) {
            const { api } = await plugin;
            await Promise.all([
              api.watchUnlink({ disable: false }).catch(() => null),
              api.phoneUnlink().catch(() => null),
            ]);
            window.location.reload();
            return;
          }
          showNotice("Every watch and phone is disconnected. Open Fatty on your iPhone to link it again.");
        });
      }}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-xl px-3.5 text-[14px] font-medium transition-colors disabled:opacity-60",
        armed ? "bg-danger/15 text-danger" : "bg-surface-2 text-text hover:bg-surface-3",
      )}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Unplug className="size-4" />}
      {armed ? "Tap to confirm" : "Disconnect"}
    </button>
  );
}
