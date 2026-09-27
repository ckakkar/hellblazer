"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * A heading you can edit in place. A textarea rather than an input, so a long
 * title wraps like the heading it is instead of running off a narrow phone;
 * it grows to fit, and Return saves (blurs) rather than starting a new line.
 */
export function TitleField({
  defaultValue,
  onCommit,
  label,
  className,
}: {
  defaultValue: string;
  onCommit: (value: string) => void;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useLayoutEffect(fit, [fit]);
  useEffect(() => {
    // The display face arrives after first paint, and rotating the phone
    // rewraps the line: both change the height.
    document.fonts?.ready.then(fit).catch(() => {});
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [fit]);

  return (
    <textarea
      ref={ref}
      rows={1}
      defaultValue={defaultValue}
      aria-label={label}
      data-display
      enterKeyHint="done"
      spellCheck={false}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      onInput={(e) => {
        // A pasted line break has nowhere to go in a title.
        const el = e.currentTarget;
        if (/[\r\n]/.test(el.value)) el.value = el.value.replace(/[\r\n]+/g, " ");
        fit();
      }}
      onBlur={(e) => onCommit(e.currentTarget.value)}
      className={cn(
        "block w-full resize-none overflow-hidden bg-transparent [text-wrap:balance] focus:outline-none",
        className,
      )}
    />
  );
}
