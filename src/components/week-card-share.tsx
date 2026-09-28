"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Share2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { shareImage } from "@/lib/share-image";

/**
 * "Share your week": the week as a fight card (/api/share/week), shown
 * first, then handed to the share sheet. `open` is a week the page was
 * opened for (the Sunday recap's notification links to it).
 */
export function WeekCardShare({ week, open }: { week: string; open?: string | null }) {
  const router = useRouter();
  const [shown, setShown] = useState<string | null>(open ?? null);
  const [card, setCard] = useState<{ week: string; blob: Blob; url: string } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!shown) return;
    let live = true;
    let url: string | null = null;
    fetch(`/api/share/week?week=${shown}`)
      .then((res) => {
        if (!res.ok) throw new Error("card");
        return res.blob();
      })
      .then((blob) => {
        if (!live) return;
        url = URL.createObjectURL(blob);
        setCard({ week: shown, blob, url });
      })
      .catch(() => {
        if (live) setFailed(shown);
      });
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [shown]);

  const ready = card && card.week === shown ? card : null;
  const broken = failed === shown;

  function close() {
    setShown(null);
    setFailed(null);
    // Opened from the recap's link: don't open again on a reload.
    if (open) router.replace("/dashboard", { scroll: false });
  }

  async function share() {
    if (!ready) return;
    setSharing(true);
    try {
      await shareImage(ready.blob, "Fatty week.png", "My week in Fatty");
    } catch {
      setFailed(shown);
    } finally {
      setSharing(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShown(week)}
        className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-3 py-1 text-[13px] font-medium text-text transition-colors active:bg-white/[0.12]"
      >
        <Share2 className="size-3.5" />
        Share
      </button>
      <Sheet
        open={shown != null}
        onClose={close}
        title="Your week"
        footer={
          <Button size="lg" className="w-full" onClick={() => void share()} disabled={!ready || sharing}>
            {sharing ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />}
            Share
          </Button>
        }
      >
        <div className="px-4 pb-4">
          <div className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-2xl bg-black">
            {ready ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ready.url} alt="Your week as a fight card" className="size-full object-cover" />
            ) : broken ? (
              <p className="absolute inset-0 flex items-center justify-center gap-2 px-6 text-center text-[15px] text-muted">
                <TriangleAlert className="size-4 shrink-0 text-warn" />
                {"Couldn't draw the card. Check your connection and try again."}
              </p>
            ) : (
              <Loader2 className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 animate-spin text-muted" />
            )}
          </div>
        </div>
      </Sheet>
    </>
  );
}
