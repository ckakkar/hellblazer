"use client";

import { useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";

/**
 * The session's date, written the way the rest of the app writes dates
 * ("Sun 11 Oct"), with the native picker under it. A bare date input showed
 * whatever the browser chose instead: "2026-10-11" in some, "10/11/2026" in
 * others. Saves on blur, as before.
 */
export function SessionDate({
  defaultValue,
  onCommit,
}: {
  defaultValue: string;
  onCommit: (date: string) => void;
}) {
  const [date, setDate] = useState(defaultValue);
  const saved = useRef(defaultValue);
  return (
    <label className="relative inline-flex items-center gap-1.5 rounded-lg px-1 py-0.5 text-[13px] text-muted focus-within:ring-2 focus-within:ring-text/25">
      <span className="tnum">{format(parseISO(date), "EEE d MMM")}</span>
      <CalendarDays aria-hidden className="size-3.5" />
      <input
        type="date"
        value={date}
        aria-label="Session date"
        onChange={(e) => e.target.value && setDate(e.target.value)}
        onClick={(e) => {
          // Desktop browsers only open the picker from their own icon, which
          // is invisible here.
          try {
            e.currentTarget.showPicker();
          } catch {
            // Already open, or not supported: the input still takes typing.
          }
        }}
        onBlur={() => {
          if (date === saved.current) return;
          saved.current = date;
          onCommit(date);
        }}
        className="absolute inset-0 size-full cursor-pointer opacity-0 [color-scheme:dark]"
      />
    </label>
  );
}
