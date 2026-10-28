"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { useAction } from "@/lib/use-action";

type Sex = "male" | "female" | "other";

/** What a ring name may be (completeOnboarding checks it again). */
const RING_NAME = /^[a-zA-Z0-9 _.-]+$/;

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
  const [saving, startSave] = useAction("save your profile");
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(suggestedName);
  const [username, setUsername] = useState("");
  const [sex, setSex] = useState<Sex | null>(null);
  const [birthday, setBirthday] = useState("");
  const bounds = birthdayBounds(today);
  const age = birthday && isAcceptedBirthday(birthday, today) ? ageOn(birthday, today) : null;
  const [height, setHeight] = useState("");
  const [bodyweight, setBodyweight] = useState("");

  // Checked as it's typed, at its own step, rather than at the end.
  const ring = username.trim();
  const ringError =
    ring && (ring.length < 2 || !RING_NAME.test(ring))
      ? "2 to 24 letters, numbers, spaces, dots, dashes or underscores."
      : null;
  const heightCm = numOrNull(height);
  const heightError = heightCm !== null && (heightCm < 80 || heightCm > 260) ? "Between 80 and 260 cm." : null;
  const bwTyped = numOrNull(bodyweight);
  const bwKg = bwTyped == null ? null : fromDisplayWeight(bwTyped, unit);
  const bwError = bwKg !== null && (bwKg < 20 || bwKg > 400) ? `That doesn't look like a bodyweight in ${unit}.` : null;
  const birthdayError = birthday && age == null ? "Pick a birthday between 10 and 100 years ago." : null;

  /**
   * Finish, or skip: skipping keeps what's valid and leaves out the rest
   * (and a ring name someone else has), so it always gets you in.
   */
  function finish(skip = false) {
    setError(null);
    startSave(async () => {
      const details = {
        displayName: orNull(name),
        username: skip && ringError ? null : orNull(username),
        sex,
        birthDate: age != null ? birthday : null,
        heightCm: skip && heightError ? null : heightCm,
        // Canonical storage is kg: convert whatever unit they typed in.
        bodyweightKg: skip && bwError ? null : bwKg,
        localDate: todayLocalISO(),
      };
      let res = await completeOnboarding(details);
      if (!res.ok && skip) res = await completeOnboarding({ ...details, username: null });
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
      <div className="grid w-full max-w-5xl grid-cols-1 overflow-hidden lg:grid-cols-[1.12fr_0.88fr] lg:rounded-3xl lg:bg-surface">
        <section className="hb-plate relative hidden min-h-[42rem] overflow-hidden bg-bg lg:block">
          <FighterArt
            fighterKey="ohma"
            variant="hero"
            priority
            className="absolute inset-0"
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
          <h1 className="text-[2.25rem] font-bold leading-[1.05] tracking-[-0.03em] text-text">
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
              <FieldLabel htmlFor="welcome-name" icon={<User className="size-3.5" />}>
                What should we call you?
              </FieldLabel>
              <Input
                id="welcome-name"
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
                <FieldLabel htmlFor="welcome-ring" icon={<AtSign className="size-3.5" />}>
                  Ring name
                </FieldLabel>
                <Input
                  id="welcome-ring"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Shown on King of the Hill"
                  maxLength={24}
                  autoCapitalize="none"
                  autoCorrect="off"
                  aria-invalid={ringError ? true : undefined}
                  aria-describedby="welcome-ring-note"
                />
                <p id="welcome-ring-note" className={cn("mt-2 text-[13px] leading-5", ringError ? "text-danger" : "text-muted")}>
                  {ringError ??
                    "With a ring name you're on King of the Hill, where other lifters see it beside your rank and the total weight you've moved. Leave it blank to stay off."}
                </p>
              </div>
            </Step>

            {/* 2: demographics */}
            <Step>
              <FieldLabel id="welcome-sex">Sex</FieldLabel>
              <div role="radiogroup" aria-labelledby="welcome-sex" className="grid grid-cols-3 gap-2">
                {SEXES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    role="radio"
                    aria-checked={sex === s.value}
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
                <FieldLabel htmlFor="welcome-birthday">
                  Birthday
                  {age != null && <span className="tnum font-normal text-muted">, age {age}</span>}
                </FieldLabel>
                <Input
                  id="welcome-birthday"
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  min={bounds.min}
                  max={bounds.max}
                  aria-invalid={birthdayError ? true : undefined}
                  aria-describedby={birthdayError ? "welcome-birthday-error" : undefined}
                />
                {birthdayError && (
                  <p id="welcome-birthday-error" className="mt-2 text-[13px] leading-5 text-danger">
                    {birthdayError}
                  </p>
                )}
              </div>

              <p className="mt-3 text-[13px] leading-5 text-muted">
                Strength standards are sex- and age-relative. This only ever
                makes your rank fairer: it never lowers it.
              </p>
            </Step>

            {/* 3: measurements */}
            <Step>
              <FieldLabel htmlFor="welcome-height" icon={<Ruler className="size-3.5" />}>
                Height
              </FieldLabel>
              <div className="relative">
                <Input
                  id="welcome-height"
                  aria-invalid={heightError ? true : undefined}
                  aria-describedby={heightError ? "welcome-height-error" : undefined}
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
              {heightError && (
                <p id="welcome-height-error" className="mt-2 text-[13px] leading-5 text-danger">
                  {heightError}
                </p>
              )}

              <div className="mt-5">
                <FieldLabel htmlFor="welcome-bodyweight">Bodyweight</FieldLabel>
                <div className="relative">
                  <Input
                    id="welcome-bodyweight"
                    aria-invalid={bwError ? true : undefined}
                    aria-describedby="welcome-bodyweight-note"
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
                <p id="welcome-bodyweight-note" className={cn("mt-2 text-[13px] leading-5", bwError ? "text-danger" : "text-muted")}>
                  {bwError ??
                    "The big lifts are judged bodyweight-relative, so this is the single most useful number you can give the judge."}
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
          onClick={() => finish(true)}
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

/** A field's name, tied to its input (`htmlFor`), or a group's (`id`). */
function FieldLabel({
  children,
  icon,
  htmlFor,
  id,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  htmlFor?: string;
  id?: string;
}) {
  const className = "mb-2 flex items-center gap-1.5 text-[13px] font-medium text-muted";
  return htmlFor ? (
    <label htmlFor={htmlFor} className={className}>
      {icon}
      {children}
    </label>
  ) : (
    <div id={id} className={className}>
      {icon}
      {children}
    </div>
  );
}
