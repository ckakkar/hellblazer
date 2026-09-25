"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AtSign, Check, Flame, Loader2, Ruler, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Stepper, Step } from "@/components/reactbits/stepper";
import { cn, selectAllOnFocus } from "@/lib/utils";
import { todayLocalISO } from "@/lib/local-date";
import { fromDisplayWeight, type Unit } from "@/lib/units";
import { completeOnboarding } from "@/lib/actions/profile";
import { ageOn, birthdayBounds, isAcceptedBirthday } from "@/lib/age";
import { FighterArt } from "@/components/tier/fighter-art";

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
  today,
}: {
  suggestedName: string;
  email: string;
  unit: Unit;
  /** The lifter's local date (yyyy-MM-dd), for the birthday picker's range. */
  today: string;
}) {
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(suggestedName);
  const [username, setUsername] = useState("");
  const [sex, setSex] = useState<Sex | null>(null);
  const [birthday, setBirthday] = useState("");
  const bounds = birthdayBounds(today);
  const age = birthday && isAcceptedBirthday(birthday, today) ? ageOn(birthday, today) : null;
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
        birthDate: age != null ? birthday : null,
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
      className="relative flex min-h-dvh flex-col items-center justify-center px-5"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 2rem)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 2rem)",
      }}
    >
      <div className="grid w-full max-w-5xl overflow-hidden lg:grid-cols-[1.12fr_0.88fr] lg:rounded-3xl lg:bg-surface">
        <section className="relative hidden min-h-[42rem] overflow-hidden lg:block">
          <FighterArt
            fighterKey="ohma"
            variant="hero"
            priority
            className="absolute inset-0"
            imageClassName="object-[center_22%]"
          />
          <div className="absolute inset-x-0 bottom-0 z-10 p-10">
            <div className="font-display text-5xl leading-[1] text-text">Set up your profile.</div>
            <p className="mt-3 max-w-sm text-[15px] leading-6 text-muted">
              Everything here is optional and you can change it later.
            </p>
          </div>
        </section>

        <div className="w-full sm:p-7 lg:flex lg:flex-col lg:justify-center">
        <div className="mb-8 lg:hidden">
          <Flame className="mb-6 size-7 text-accent" strokeWidth={2.25} />
          <h1 className="font-display text-[2.25rem] leading-[1.05] text-text">
            Set up your profile
          </h1>
          <p className="mt-2 text-[15px] leading-6 text-muted">
            A few details so the judge can rank you fairly. All optional, all
            editable later.
          </p>
        </div>

        <div className="rounded-3xl bg-surface p-5 sm:p-6 lg:bg-transparent lg:p-0">
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
                  {isLastStep ? "Finish" : "Continue"}
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
              <p className="mt-2 text-[13px] leading-5 text-muted">
                {email ? `Signed in as ${email}.` : "Private to your account."}
              </p>

              <div className="mt-5">
                <FieldLabel icon={<AtSign className="size-3.5" />}>
                  Ring name
                </FieldLabel>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Shown on King of the Hill"
                  maxLength={24}
                  autoCapitalize="none"
                  autoCorrect="off"
                />
                <p className="mt-2 text-[13px] leading-5 text-muted">
                  This is the only thing other fighters see. Leave it blank to
                  stay off King of the Hill.
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
                      "h-11 rounded-xl text-[15px] font-medium transition-colors",
                      sex === s.value ? "bg-text text-bg" : "bg-surface-2 text-muted hover:text-text",
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="mt-5">
                <FieldLabel>
                  Birthday
                  {age != null && <span className="tnum font-normal text-muted"> · {age}</span>}
                </FieldLabel>
                <Input
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  min={bounds.min}
                  max={bounds.max}
                  aria-label="Birthday"
                />
              </div>

              <p className="mt-3 text-[13px] leading-5 text-muted">
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
                <span className="tnum pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] text-muted">
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
                  <span className="tnum pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] text-muted">
                    {unit}
                  </span>
                </div>
                <p className="mt-2 text-[13px] leading-5 text-muted">
                  The big lifts are judged bodyweight-relative, so this is the
                  single most useful number you can give the judge.
                </p>
              </div>

              {error && (
                <p className="mt-4 rounded-xl bg-danger/10 px-3.5 py-2.5 text-[13px] text-danger">
                  {error}
                </p>
              )}
            </Step>
          </Stepper>
        </div>

        <button
          onClick={finish}
          disabled={saving}
          className="mx-auto mt-6 block text-[14px] text-muted underline-offset-4 transition-colors hover:text-text hover:underline disabled:opacity-50"
        >
          Skip for now
        </button>
        </div>
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
    <div className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-muted">
      {icon}
      {children}
    </div>
  );
}
