"use client";

import { useState } from "react";
import { Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shareImage } from "@/lib/share-image";

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
      await shareImage(blob, "Fatty workout.png", `${title}: my Fatty workout`);
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
