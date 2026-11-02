"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, CopyPlus, Loader2, Play } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { repeatSession, saveSessionAsTemplate } from "@/lib/actions/sessions";
import { todayLocalISO } from "@/lib/local-date";
import { useAction } from "@/lib/use-action";
import { cn } from "@/lib/utils";

/**
 * What a finished workout can become: today's workout again, with what was
 * done as the targets, or a template to plan from. Starting is for the phone
 * (`canRepeat` is false on an iPad, and while another workout is under way).
 */
export function AgainActions({
  sessionId,
  defaultName,
  canRepeat,
}: {
  sessionId: string;
  /** The template's name to start from: the workout's title, else its lifts. */
  defaultName: string;
  canRepeat: boolean;
}) {
  const [starting, start] = useAction("start the workout");
  const [saving, save] = useAction("save the template");
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState(defaultName);
  const [saved, setSaved] = useState(false);

  function keep() {
    const trimmed = name.trim();
    if (!trimmed) return;
    save(async () => {
      await saveSessionAsTemplate({ sessionId, name: trimmed });
      setSaved(true);
      setNaming(false);
    });
  }

  return (
    <div className={cn("mb-8 grid gap-2 lg:flex", canRepeat ? "grid-cols-2" : "grid-cols-1")}>
      {canRepeat && (
        <Button
          variant="accent"
          disabled={starting}
          onClick={() => start(() => repeatSession({ sessionId, localDate: todayLocalISO() }))}
        >
          {starting ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          Do it again
        </Button>
      )}
      {saved ? (
        <Link href="/templates" className={buttonVariants({ variant: "secondary" })}>
          <Check className="size-4" />
          In Templates
        </Link>
      ) : (
        <Button variant="secondary" onClick={() => setNaming(true)}>
          {/* On a 320pt phone the words alone fit beside "Do it again". */}
          <CopyPlus className="size-4 max-[359px]:hidden" />
          Save as template
        </Button>
      )}

      <Sheet
        open={naming}
        onClose={() => setNaming(false)}
        title="Save as template"
        footer={
          <Button size="lg" className="w-full" disabled={saving || !name.trim()} onClick={keep}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save template
          </Button>
        }
      >
        <form
          className="px-4 pb-2 pt-1"
          onSubmit={(e) => {
            e.preventDefault();
            keep();
          }}
        >
          <label className="block px-1 pb-2 text-[13px] text-muted" htmlFor="template-name">
            Name
          </label>
          <Input
            id="template-name"
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
          <p className="mt-3 px-1 text-[13px] leading-5 text-muted">
            The exercises you did, in order, each with the sets and reps you did. Change it any time on the
            Templates page.
          </p>
        </form>
      </Sheet>
    </div>
  );
}
