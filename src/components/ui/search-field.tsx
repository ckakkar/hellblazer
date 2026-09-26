"use client";

import { useRef } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * A search box that behaves like iOS's: a Search key instead of Return
 * (which puts the keyboard away), no autocorrect or capitals, and a round
 * clear button once there's something to clear, in place of WebKit's own.
 */
export function SearchField({
  value,
  onValueChange,
  placeholder,
  label,
  autoFocus,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  /** The accessible name, when it differs from the placeholder. */
  label?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
      <Input
        ref={input}
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        className="appearance-none pl-10 pr-10 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          // Keep focus (and the keyboard) in the field, as iOS does.
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => {
            onValueChange("");
            input.current?.focus();
          }}
          className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center"
        >
          <span className="flex size-[18px] items-center justify-center rounded-full bg-muted/60 text-bg">
            <X className="size-3" strokeWidth={3} />
          </span>
        </button>
      )}
    </div>
  );
}
