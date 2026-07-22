"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/\\[]{}<>*!?#力闘鬼";

/**
 * React Bits-style "Decrypted Text": the string scrambles through random
 * glyphs and resolves left-to-right, and re-scrambles on hover. CSS/JS only —
 * one interval, cleaned up, and disabled under reduced-motion.
 */
export function DecryptedText({
  text,
  className,
  speed = 45,
}: {
  text: string;
  className?: string;
  speed?: number;
}) {
  const [display, setDisplay] = useState(text);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const scramble = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    let tick = 0;
    timer.current = setInterval(() => {
      tick += 1;
      const revealed = Math.floor(tick / 2);
      setDisplay(
        text
          .split("")
          .map((ch, i) => {
            if (ch === " " || ch === "\n") return ch;
            if (i < revealed) return ch;
            return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          })
          .join(""),
      );
      if (revealed >= text.length && timer.current) {
        clearInterval(timer.current);
        timer.current = null;
        setDisplay(text);
      }
    }, speed);
  }, [text, speed]);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return; // initial display already equals text
    scramble();
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [scramble]);

  return (
    <span
      className={cn("cursor-default", className)}
      onMouseEnter={scramble}
      aria-label={text}
    >
      {display}
    </span>
  );
}
