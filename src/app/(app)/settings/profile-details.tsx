"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { updateProfileDetails } from "@/lib/actions/profile";

type Sex = "male" | "female" | "other";
const SEXES: { key: Sex; label: string }[] = [
  { key: "male", label: "Male" },
  { key: "female", label: "Female" },
  { key: "other", label: "Other" },
];

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

export function ProfileDetails({
  displayName: initName,
  sex: initSex,
  age: initAge,
  heightCm: initHeight,
}: {
  displayName: string | null;
  sex: Sex | null;
  age: number | null;
  heightCm: number | null;
}) {
  const [name, setName] = useState(initName ?? "");
  const [sex, setSex] = useState<Sex | null>(initSex);
  const [age, setAge] = useState(initAge != null ? String(initAge) : "");
  const [height, setHeight] = useState(
    initHeight != null ? String(initHeight) : "",
  );
  const [, start] = useTransition();
  const [saved, setSaved] = useState(false);

  function persist(next: {
    name?: string;
    sex?: Sex | null;
    age?: string;
    height?: string;
  }) {
    const n = next.name !== undefined ? next.name : name;
    const s = next.sex !== undefined ? next.sex : sex;
    const a = next.age !== undefined ? next.age : age;
    const h = next.height !== undefined ? next.height : height;

    const ageN = a.trim() === "" ? null : Math.round(Number(a));
    const heightN = h.trim() === "" ? null : Number(h);

    start(async () => {
      await updateProfileDetails({
        displayName: n.trim() === "" ? null : n.trim().slice(0, 60),
        sex: s,
        age: ageN != null && Number.isFinite(ageN) ? clamp(ageN, 10, 100) : null,
        heightCm:
          heightN != null && Number.isFinite(heightN)
            ? clamp(heightN, 80, 260)
            : null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    });
  }

  return (
    <div className="grid gap-4">
      <label className="grid gap-1.5">
        <span className="text-xs font-medium text-muted">Name</span>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => persist({})}
          placeholder="Your name"
          autoComplete="name"
          maxLength={60}
          aria-label="Your name"
        />
      </label>

      <div className="grid gap-1.5">
        <span className="text-xs font-medium text-muted">Sex</span>
        <div className="inline-flex w-full rounded-lg border border-border bg-surface-2 p-0.5">
          {SEXES.map((o) => (
            <button
              key={o.key}
              type="button"
              aria-pressed={sex === o.key}
              onClick={() => {
                const next = sex === o.key ? null : o.key;
                setSex(next);
                persist({ sex: next });
              }}
              className={cn(
                "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50",
                sex === o.key
                  ? "bg-accent text-bg"
                  : "text-muted hover:text-text",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-muted">Age</span>
          <Input
            type="number"
            inputMode="numeric"
            min={10}
            max={100}
            value={age}
            onChange={(e) => setAge(e.target.value)}
            onBlur={() => persist({})}
            placeholder="years"
            aria-label="Age in years"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-muted">Height</span>
          <div className="relative">
            <Input
              type="number"
              inputMode="decimal"
              min={80}
              max={260}
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              onBlur={() => persist({})}
              placeholder="cm"
              aria-label="Height in centimetres"
              className="pr-9"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
              cm
            </span>
          </div>
        </label>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted">
        {saved ? (
          <>
            <Check className="size-3.5 text-accent" />
            <span className="text-accent">Saved</span>
          </>
        ) : (
          "Sharpens your strength rank — standards are sex- and bodyweight-relative."
        )}
      </p>
    </div>
  );
}
