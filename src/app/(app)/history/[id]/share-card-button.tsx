"use client";

import { useState } from "react";
import { Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Builds the session's shareable PNG (via /api/share/[id]) and hands it to the
 * native share sheet when the device supports sharing files (iOS/Android), else
 * falls back to a direct download.
 */
export function ShareCardButton({
  sessionId,
  title,
}: {
  sessionId: string;
  title: string;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function share() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/share/${sessionId}`);
      if (!res.ok) throw new Error("build failed");
      const blob = await res.blob();
      const file = new File([blob], `hell-blazer-${sessionId}.png`, {
        type: "image/png",
      });

      const nav = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
      };
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({
          files: [file],
          title: "Hell Blazer",
          text: `${title} — my Hell Blazer workout`,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `hell-blazer-${title || "workout"}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      // A user cancelling the share sheet is not an error.
      if ((e as Error)?.name !== "AbortError") {
        setMsg("Couldn't build the card. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="secondary" size="sm" onClick={share} disabled={busy}>
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Share2 className="size-4" />
        )}
        Share
      </Button>
      {msg && <span className="text-xs text-danger">{msg}</span>}
    </div>
  );
}
