"use client";

import { useState } from "react";
import { SettingsRow } from "@/components/ui/settings-list";
import { Switch } from "@/components/ui/switch";
import { setShowRpe } from "@/lib/actions/settings";
import { useAction } from "@/lib/use-action";

/**
 * Whether the set editor asks for RPE, effort out of 10. Off by default:
 * most lifters never fill it in, and next time's targets work without it.
 */
export function RpeRow({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [, start] = useAction("change the RPE setting");
  return (
    <SettingsRow
      label="Rate each set (RPE)"
      hint="Effort out of 10 beside each set. When it's there, an easy set lets the weight go up sooner."
      control={
        <Switch
          checked={on}
          onChange={(next) => {
            setOn(next);
            start(
              async () => {
                await setShowRpe({ on: next });
              },
              () => setOn(!next),
            );
          }}
          label="Rate each set's effort (RPE)"
        />
      }
    />
  );
}
