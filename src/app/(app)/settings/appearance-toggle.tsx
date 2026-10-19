"use client";

import { useState } from "react";
import { Segmented } from "@/components/ui/segmented";
import { setAppearance } from "@/lib/actions/settings";
import { useAction } from "@/lib/use-action";
import { withNative } from "@/lib/native-plugins";
import type { Appearance } from "@/lib/settings";

/**
 * Night, paper, or whatever the device is set to. Applies at once (the
 * <html data-theme> the CSS reads), and in the iOS app tells the window too,
 * so the status bar and the keyboard match; the cookie makes the server's
 * next render agree, with no flash.
 */
export function AppearanceToggle({ current }: { current: Appearance }) {
  const [appearance, setLocal] = useState<Appearance>(current);
  const [, start] = useAction("change the appearance");

  function apply(next: Appearance) {
    const root = document.documentElement;
    if (next === "system") delete root.dataset.theme;
    else root.dataset.theme = next;
    withNative(async (api) => api.setAppearance?.({ appearance: next }));
  }

  function choose(next: Appearance) {
    if (next === appearance) return;
    const previous = appearance;
    setLocal(next);
    apply(next);
    start(
      async () => {
        await setAppearance({ appearance: next });
      },
      () => {
        setLocal(previous);
        apply(previous);
      },
    );
  }

  return (
    <Segmented
      label="Appearance"
      options={[
        { value: "system", label: "Auto", ariaLabel: "Match the device" },
        { value: "light", label: "Light" },
        { value: "dark", label: "Dark" },
      ]}
      value={appearance}
      onChange={choose}
    />
  );
}
