"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn, selectAllOnFocus } from "@/lib/utils";
import { updateProfileDetails } from "@/lib/actions/profile";
import { ageOn, birthdayBounds, isAcceptedBirthday } from "@/lib/age";

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
  birthDate: initBirthDate,
  birthYear,
  today,
  heightCm: initHeight,
}: {
  displayName: string | null;
  sex: Sex | null;
  /** yyyy-MM-dd, or null when they've only ever given a birth year (or nothing). */
  birthDate: string | null;
  /** From profiles made before birthdays were asked for. */
  birthYear: number | null;
  /** The lifter's local date, yyyy-MM-dd, from the server. */
  today: string;
  heightCm: number | null;
}) {
  const [name, setName] = useState(initName ?? "");
  const [sex, setSex] = useState<Sex | null>(initSex);
  const [birthday, setBirthday] = useState(initBirthDate ?? "");
  const [height, setHeight] = useState(
    initHeight != null ? String(initHeight) : "",
  );
  const [, start] = useTransition();
  const bounds = birthdayBounds(today);
  const age = birthday ? ageOn(birthday, today) : birthYear != null ? Number(today.slice(0, 4)) - birthYear : null;
  const [saved, setSaved] = useState(false);

  /** `birthday` is only sent when it changed, so an old birth year survives other edits. */
  function persist(next: {
    name?: string;
    sex?: Sex | null;
    birthday?: string;
    height?: string;
  }) {
    const n = next.name !== undefined ? next.name : name;
    const s = next.sex !== undefined ? next.sex : sex;
    const h = next.height !== undefined ? next.height : height;

    const heightN = h.trim() === "" ? null : Number(h);

    start(async () => {
      await updateProfileDetails({
        displayName: n.trim() === "" ? null : n.trim().slice(0, 60),
        sex: s,
        ...(next.birthday !== undefined ? { birthDate: next.birthday || null } : {}),
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
        <div className="inline-flex w-full rounded-full bg-white/[0.06] p-0.5">
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
                "h-9 flex-1 rounded-full px-3 text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-text/40",
                sex === o.key
                  ? "bg-white/[0.12] text-text"
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
          <span className="text-xs font-medium text-muted">
            Birthday
            {age != null && <span className="tnum"> · {age}</span>}
          </span>
          <Input
            type="date"
            min={bounds.min}
            max={bounds.max}
            value={birthday}
            onChange={(e) => {
              const value = e.target.value;
              setBirthday(value);
              // Saves once the date is whole and in range (typing a year on a
              // desktop passes through dates like 0019-05-02 first).
              if (value === "" || isAcceptedBirthday(value, today)) persist({ birthday: value });
            }}
            aria-label="Birthday"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-muted">Height</span>
          <div className="relative">
            <Input
              type="number"
              onFocus={selectAllOnFocus}
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

      {!birthday && birthYear != null && (
        <p className="-mt-2 text-xs text-muted">
          You gave a birth year ({birthYear}) earlier. Add your birthday for an exact age.
        </p>
      )}

      <p className="flex items-center gap-1.5 text-xs text-muted">
        {saved ? (
          <>
            <Check className="size-3.5 text-text" />
            <span className="text-text">Saved</span>
          </>
        ) : (
          "Sharpens your strength rank: standards are sex- and bodyweight-relative."
        )}
      </p>
    </div>
  );
}
