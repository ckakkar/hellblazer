"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AtSign, Check, Flame, Loader2, Ruler, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Stepper, Step } from "@/components/reactbits/stepper";
import { BlurText } from "@/components/reactbits/blur-text";
import { cn, selectAllOnFocus } from "@/lib/utils";
import { todayLocalISO } from "@/lib/local-date";
import { fromDisplayWeight, type Unit } from "@/lib/units";
import { completeOnboarding } from "@/lib/actions/profile";

type Sex = "male" | "female" | "other";

const SEXES: { value: Sex; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

/** Trim to null so an untouched optional field stores as null, not "". */
function orNull(s: string): string | null {
  const t = s.trim();
  return t.length > 0 ? t : null;
}

function numOrNull(s: string): number | null {
  const n = Number(s.trim());
  return s.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
}

export function WelcomeFlow({
  suggestedName,
  email,
  unit,
}: {
  suggestedName: string;
  email: string;
  unit: Unit;
}) {
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(suggestedName);
  const [username, setUsername] = useState("");
  const [sex, setSex] = useState<Sex | null>(null);
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [bodyweight, setBodyweight] = useState("");

  function finish() {
    setError(null);
    startSave(async () => {
      const bw = numOrNull(bodyweight);
      const res = await completeOnboarding({
        displayName: orNull(name),
        username: orNull(username),
        sex,
        age: numOrNull(age),
        heightCm: numOrNull(height),
        // Canonical storage is kg: convert whatever unit they typed in.
        bodyweightKg: bw == null ? null : fromDisplayWeight(bw, unit),
        localDate: todayLocalISO(),
      });
      if (!res.ok) {
        setError(
          res.error === "taken"
            ? "That ring name is already claimed. Try another."
            : "Something in there didn't look right: check your details.",
        );
        return;
      }
      router.replace("/dashboard");
    });
  }

  return (
    // Outside the (app) layout, so safe-area insets are handled here: the notch
    // at the top and the home indicator at the bottom. `justify-center` only
    // once there's room, so a small screen with the keyboard up scrolls
    // normally instead of clipping the step.
    <main
      className="relative flex min-h-dvh flex-col items-center justify-center px-4"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 2rem)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 2rem)",
      }}
    >
      {/* Ambient accent wash, matching the app shell */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(120% 55% at 50% -8%, rgb(var(--accent-rgb) / 0.10), transparent 62%)",
        }}
      />

      <div className="w-full max-w-md">
        <div className="mb-7 text-center">
          <span className="mx-auto mb-4 flex size-11 items-center justify-center rounded-xl border border-accent/40 bg-accent/10 text-accent">
            <Flame className="size-5" />
          </span>
          <BlurText
            as="h1"
            text="Enter the arena"
            animateBy="words"
            delay={120}
            className="justify-center font-impact text-4xl uppercase leading-none tracking-tight text-text sm:text-5xl"
          />
          <p className="mt-3 text-sm text-muted">
            A few details so the judge can rank you honestly. All of it is
            optional and editable later.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-5 shadow-card sm:p-6">
          <Stepper
            disableStepIndicators={saving}
            renderFooter={({ isFirstStep, isLastStep, back, next, complete }) => (
              <div className="flex items-center gap-3">
                {!isFirstStep && (
                  <Button variant="ghost" onClick={back} disabled={saving}>
                    Back
                  </Button>
                )}
                <Button
                  className="ml-auto"
                  disabled={saving}
                  onClick={() => {
                    if (!isLastStep) return next();
                    complete();
                    finish();
                  }}
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : isLastStep ? (
                    <Check className="size-4" />
                  ) : null}
                  {isLastStep ? "Enter the arena" : "Continue"}
                </Button>
              </div>
            )}
          >
            {/* 1: identity */}
            <Step>
              <FieldLabel icon={<User className="size-3.5" />}>
                What should we call you?
              </FieldLabel>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
                maxLength={60}
              />
              <p className="mt-2 text-xs text-muted">
                {email ? `Signed in as ${email}.` : "Private to your account."}
              </p>

              <div className="mt-5">
                <FieldLabel icon={<AtSign className="size-3.5" />}>
                  Ring name
                </FieldLabel>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Shown on the leaderboard"
                  maxLength={24}
                  autoCapitalize="none"
                  autoCorrect="off"
                />
                <p className="mt-2 text-xs text-muted">
                  This is the only thing other fighters see. Leave it blank to
                  stay off the leaderboard.
                </p>
              </div>
            </Step>

            {/* 2: demographics */}
            <Step>
              <FieldLabel>Sex</FieldLabel>
              <div className="grid grid-cols-3 gap-2">
                {SEXES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setSex(sex === s.value ? null : s.value)}
                    className={cn(
                      "h-10 rounded-lg border text-sm font-medium transition-colors active:scale-[0.97]",
                      sex === s.value
                        ? "border-accent/60 bg-accent/10 text-accent"
                        : "border-border bg-surface-2 text-muted hover:text-text",
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="mt-5">
                <FieldLabel>Age</FieldLabel>
                <Input
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  inputMode="numeric"
                  type="number"
                  onFocus={selectAllOnFocus}
                  placeholder="Years"
                  min={10}
                  max={100}
                />
              </div>

              <p className="mt-3 text-xs text-muted">
                Strength standards are sex- and age-relative. This only ever
                makes your rank fairer: it never lowers it.
              </p>
            </Step>

            {/* 3: measurements */}
            <Step>
              <FieldLabel icon={<Ruler className="size-3.5" />}>
                Height
              </FieldLabel>
              <div className="relative">
                <Input
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  inputMode="decimal"
                  type="number"
                  onFocus={selectAllOnFocus}
                  placeholder="Centimetres"
                  min={80}
                  max={260}
                  className="pr-12"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted">
                  cm
                </span>
              </div>

              <div className="mt-5">
                <FieldLabel>Bodyweight</FieldLabel>
                <div className="relative">
                  <Input
                    value={bodyweight}
                    onChange={(e) => setBodyweight(e.target.value)}
                    inputMode="decimal"
                    type="number"
                    onFocus={selectAllOnFocus}
                    placeholder={`Your current weight in ${unit}`}
                    className="pr-12"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted">
                    {unit}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted">
                  The big lifts are judged bodyweight-relative, so this is the
                  single most useful number you can give the judge.
                </p>
              </div>

              {error && (
                <p className="mt-4 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
                  {error}
                </p>
              )}
            </Step>
          </Stepper>
        </div>

        <button
          onClick={finish}
          disabled={saving}
          className="mx-auto mt-5 block text-xs text-muted underline-offset-4 transition-colors hover:text-text hover:underline disabled:opacity-50"
        >
          Skip for now
        </button>
      </div>
    </main>
  );
}

function FieldLabel({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted">
      {icon}
      {children}
    </div>
  );
}
