"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" fill="currentColor">
      <path d="M16.37 12.63c-.02-2.33 1.9-3.45 1.99-3.5-1.08-1.59-2.77-1.8-3.37-1.83-1.43-.15-2.8.84-3.53.84-.73 0-1.85-.82-3.04-.8-1.56.02-3 .91-3.8 2.31-1.62 2.81-.41 6.97 1.16 9.25.77 1.12 1.69 2.37 2.9 2.33 1.16-.05 1.6-.75 3.01-.75 1.4 0 1.8.75 3.03.73 1.25-.02 2.04-1.14 2.8-2.26.88-1.3 1.25-2.55 1.27-2.62-.03-.01-2.43-.93-2.42-3.7zM14.07 5.78c.64-.78 1.07-1.85.95-2.93-.92.04-2.04.61-2.7 1.39-.59.69-1.11 1.79-.97 2.85 1.03.08 2.07-.52 2.72-1.31z" />
    </svg>
  );
}

/**
 * Sign in with Apple, shown only inside the iOS app (App Store rules require
 * it next to Google there). Apple's own Face ID sheet does the work; see
 * src/lib/native-auth.ts. Styled as Apple's white button on a dark screen.
 */
export function AppleSignIn({ next = "/dashboard" }: { next?: string }) {
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function signIn() {
    setLoading(true);
    setNote(null);
    const { signInInApp } = await import("@/lib/native-auth");
    const result = await signInInApp("apple", next);
    if (!result.ok) {
      setLoading(false);
      setNote(result.message);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-2 sm:w-auto">
      <Button
        size="xl"
        variant="secondary"
        onClick={signIn}
        disabled={loading}
        className="w-full bg-white text-black hover:bg-white/90 sm:w-auto"
      >
        {loading ? <Loader2 className="size-5 animate-spin" /> : <AppleGlyph />}
        Continue with Apple
      </Button>
      {note && (
        <p role="status" className="text-center text-[13px] text-muted">
          {note}
        </p>
      )}
    </div>
  );
}
