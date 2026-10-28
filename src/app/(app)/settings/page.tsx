import type { Metadata } from "next";
import { getUser } from "@/lib/auth";
import { format, parseISO } from "date-fns";
import { getUnit, getAccent, getAppearance, getTimeZone, getToday } from "@/lib/settings";
import { dateInTimeZone } from "@/lib/local-date";
import { getBodyweightLog } from "@/lib/data/bodyweight";
import { getSessionSummaries } from "@/lib/data/sessions";
import { profileAge } from "@/lib/age";
import { formatVolume, toDisplayBodyweight, trimNum, type Unit } from "@/lib/units";
import { SectionLabel } from "@/components/ui/page-header";
import { cn, fitFigure } from "@/lib/utils";
import { getProfile } from "@/lib/data/profile";
import { getEvalGate } from "@/lib/data/evaluation";
import { getActiveProgramProgress } from "@/lib/data/programs";
import { getNotificationState } from "@/lib/data/push";
import { getTier } from "@/lib/tiers";
import { accentSwatch } from "@/lib/accents";
import { ProfileIdentity, type TapeFigure } from "@/components/tier/profile-identity";
import {
  SettingsGroup,
  SettingsRow,
} from "@/components/ui/settings-list";
import { UnitToggle } from "./unit-toggle";
import { AppearanceToggle } from "./appearance-toggle";
import { appearanceIsLocked } from "@/lib/surface";
import { ThemeSelector } from "./theme-selector";
import { ProfileDetails } from "./profile-details";
import { UsernameField } from "./username-field";
import { BodyweightManager } from "./bodyweight-manager";
import { BodyweightChart } from "@/components/charts/bodyweight-chart";
import { NotificationsManager } from "./notifications-manager";
import { TierEvaluator } from "./tier-evaluator";
import { DangerZone } from "./danger-zone";
import { AppleHealthSettings } from "./apple-health";
import { AppleWatchSettings } from "./apple-watch";
import { KeepAwakeRow } from "./keep-awake-row";
import { WeeklyRecapRow } from "./weekly-recap-row";
import { SignOutButton } from "./sign-out-button";
import { ExportButton } from "./export-button";
import { SignInMethods, type SignInMethod } from "./sign-in-methods";

export const metadata: Metadata = { title: "Profile" };

export const dynamic = "force-dynamic";

/** Height as the lifter reads it: centimetres, or feet and inches beside pounds. */
function heightFigure(cm: number | null | undefined, unit: Unit): Pick<TapeFigure, "value" | "unit"> {
  if (!cm) return { value: null };
  if (unit === "kg") return { value: String(Math.round(cm)), unit: "cm" };
  const inches = Math.round(cm / 2.54);
  return { value: `${Math.floor(inches / 12)}′${inches % 12}″` };
}

type RecordFigure = { label: string; value: string; unit?: string };

/** Every finished workout with work in it, as the record counts them. */
function trainingRecord(
  summaries: Awaited<ReturnType<typeof getSessionSummaries>>,
  unit: Unit,
): RecordFigure[] | null {
  const done = summaries.filter((s) => s.finished_at && Number(s.working_sets ?? 0) > 0);
  if (done.length === 0) return null;
  const sets = done.reduce((n, s) => n + Number(s.working_sets ?? 0), 0);
  const volume = done.reduce((n, s) => n + Number(s.total_volume ?? 0), 0);
  const first = done.reduce((a, s) => (s.session_date && s.session_date < a ? s.session_date : a), done[0].session_date ?? "");
  const moved = formatVolume(volume, unit);
  return [
    { label: "Workouts", value: done.length.toLocaleString("en-US") },
    { label: "Working sets", value: sets.toLocaleString("en-US") },
    { label: "Moved", value: moved.replace(` ${unit}`, ""), unit },
    { label: "Training since", value: first ? format(parseISO(first), "MMM yyyy") : "" },
  ];
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ link_error?: string }>;
}) {
  const { link_error: linkError } = await searchParams;
  const [user, unit, accent, logs, profile, active, notifications, evalGate, tz, today, appearance, appearanceLocked, summaries] =
    await Promise.all([
      getUser(),
      getUnit(),
      getAccent(),
      getBodyweightLog(),
      getProfile(),
      getActiveProgramProgress(),
      getNotificationState(),
      getEvalGate(),
      getTimeZone(),
      getToday(),
      getAppearance(),
      appearanceIsLocked(),
      getSessionSummaries(),
    ]);

  // Formatted here, in the lifter's timezone: a client component formatting
  // the timestamp itself renders differently on the server and the phone.
  const evaluatedLabel = profile?.tier_evaluated_at
    ? format(parseISO(dateInTimeZone(new Date(profile.tier_evaluated_at), tz)), "d MMM yyyy")
    : null;

  // Which ways into this account exist: Google, Apple, or both.
  const method = (provider: "google" | "apple"): SignInMethod => {
    const identity = user?.identities?.find((i) => i.provider === provider);
    const email = identity?.identity_data?.email;
    return { connected: Boolean(identity), email: typeof email === "string" ? email : null };
  };
  const signInMethods = { google: method("google"), apple: method("apple") };

  const activeProgram = active
    ? { id: active.program.id, name: active.program.name }
    : null;

  // The Google (or Apple) account's picture and name are the best identity we
  // have; the profile row overrides them once it's filled in.
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const avatarUrl =
    typeof meta.avatar_url === "string"
      ? meta.avatar_url
      : typeof meta.picture === "string"
        ? meta.picture
        : null;
  const googleName =
    typeof meta.full_name === "string"
      ? meta.full_name
      : typeof meta.name === "string"
        ? meta.name
        : null;

  const latest = logs[0] ?? null;
  const age = profileAge(profile, today);
  const tape: TapeFigure[] = [
    { label: "Height", ...heightFigure(profile?.height_cm, unit) },
    {
      label: "Weight",
      value: latest ? trimNum(toDisplayBodyweight(latest.weight_kg, unit)) : null,
      unit,
    },
    { label: "Age", value: age !== null ? String(age) : null },
  ];
  const record = trainingRecord(summaries, unit);

  // The bodyweight's move across the entries the chart shows.
  const oldest = logs.length > 1 ? logs[logs.length - 1] : null;
  const bodyweightChange =
    latest && oldest
      ? toDisplayBodyweight(latest.weight_kg, unit) - toDisplayBodyweight(oldest.weight_kg, unit)
      : null;

  return (
    <div>
      <ProfileIdentity
        name={profile?.display_name ?? googleName}
        ringName={profile?.username ?? null}
        email={user?.email ?? null}
        avatarUrl={avatarUrl}
        tier={getTier(profile?.tier)}
        tape={tape}
        className="mb-10 lg:mb-14"
      />

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-start lg:gap-x-14">
        <div className="grid min-w-0 grid-cols-1 gap-12 lg:col-span-7">
          {record && (
            <section>
              <SectionLabel>Record</SectionLabel>
              <dl className="grid grid-cols-2 border-y border-text/[0.12] sm:grid-cols-4">
                {record.map((f, i) => (
                  <div
                    key={f.label}
                    className={cn(
                      "@container min-w-0 border-text/[0.08] py-4 pr-3 [--stat-max:1.75rem] lg:[--stat-max:2.25rem]",
                      i % 2 === 1 ? "border-l pl-4" : "pl-1",
                      i >= 2 && "border-t sm:border-t-0",
                      i === 2 && "sm:border-l sm:pl-4",
                    )}
                  >
                    <dt className="truncate text-[13px] text-muted">{f.label}</dt>
                    {/* The figure shrinks to its column ("Sep 2026" beside
                        "232.9k kg" on a desktop's narrower quarter). */}
                    <dd className="mt-1.5 flex h-[1.75rem] items-end whitespace-nowrap leading-none lg:h-[2.25rem]">
                      <span
                        className="font-display hb-fit text-text"
                        style={fitFigure(f.value, "var(--stat-max)", f.unit ? "1.5rem" : "0px")}
                      >
                        {f.value}
                      </span>
                      {f.unit && <span className="ml-1 text-[13px] text-muted">{f.unit}</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <section>
            <SectionLabel>Strength rank</SectionLabel>
            <TierEvaluator
              currentTierKey={profile?.tier ?? null}
              rationale={profile?.tier_rationale ?? null}
              evaluatedLabel={evaluatedLabel}
              gate={evalGate}
            />
          </section>

          <section>
            <SectionLabel
              action={
                latest ? (
                  <span className="tnum whitespace-nowrap text-[13px] text-muted">
                    {bodyweightChange !== null && Math.abs(bodyweightChange) >= 0.05
                      ? `${bodyweightChange > 0 ? "+" : "−"}${trimNum(Math.round(Math.abs(bodyweightChange) * 10) / 10)} ${unit} since ${format(parseISO(oldest!.date), "d MMM")}`
                      : oldest
                        ? `Level since ${format(parseISO(oldest.date), "d MMM")}`
                        : null}
                  </span>
                ) : undefined
              }
            >
              Bodyweight
            </SectionLabel>
            <div className="border-t border-text/[0.12] pt-4">
              <BodyweightChart logs={logs} unit={unit} />
            </div>
            <div className="mt-4">
              <BodyweightManager logs={logs} unit={unit} today={today} />
            </div>
            <p className="px-1 pt-3 text-[13px] leading-5 text-muted">
              The judge ranks you relative to your size.
            </p>
          </section>

          <SettingsGroup
            id="about-you"
            label="About you"
            caption="Your ring name shows on King of the Hill. The rest is the tale of the tape above, and calibrates your strength rank."
          >
            <SettingsRow label="Ring name">
              <UsernameField current={profile?.username ?? null} />
            </SettingsRow>
            <SettingsRow label="Details">
              <ProfileDetails
                displayName={profile?.display_name ?? null}
                sex={(profile?.sex as "male" | "female" | "other" | null) ?? null}
                birthDate={profile?.birth_date ?? null}
                birthYear={profile?.birth_year ?? null}
                today={today}
                heightCm={profile?.height_cm ?? null}
              />
            </SettingsRow>
          </SettingsGroup>
        </div>

        <aside className="grid min-w-0 grid-cols-1 gap-8 lg:col-span-5">
          <SectionLabel className="-mb-5">Settings</SectionLabel>
          <SettingsGroup
            label="Preferences"
            caption="Weights are always stored in kg and converted for display."
          >
            {/* An app build that can only be dark doesn't offer the choice. */}
            {!appearanceLocked && (
              <SettingsRow label="Appearance" control={<AppearanceToggle current={appearance} />} />
            )}
            <SettingsRow label="Units" control={<UnitToggle current={unit} />} />
            <SettingsRow
              label="Accent"
              hint="Named after the Kengan Association companies."
            >
              <ThemeSelector current={accent} />
            </SettingsRow>
            <KeepAwakeRow />
          </SettingsGroup>

          <SettingsGroup
            label="Notifications"
            caption="A reminder on days your programmed workout is due, and a recap of your week on Sunday."
          >
            <SettingsRow label="Daily reminder">
              <NotificationsManager
                reminderHour={notifications.reminderHour}
                vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
              />
            </SettingsRow>
            <WeeklyRecapRow initial={notifications.weeklyRecap} />
          </SettingsGroup>

          <AppleHealthSettings />

          {user && (
            <AppleWatchSettings userId={user.id} unit={unit} accent={accentSwatch(accent)} />
          )}

          <SignInMethods methods={signInMethods} linkError={linkError} />

          <SettingsGroup label="Account">
            <SettingsRow
              label="Export your data"
              hint="Every logged set as a CSV, weights in kg."
              control={<ExportButton />}
            />
            <SettingsRow label="Privacy" href="/privacy" />
            <SettingsRow label="Support" hint="cyrus@kkrwhofrags.xyz" href="/support" />
            <SettingsRow
              label="Signed in"
              hint={user?.email ?? undefined}
              control={<SignOutButton />}
            />
          </SettingsGroup>

          <section>
            <h2 className="px-4 pb-2 text-[13px] font-medium text-muted">Reset</h2>
            <div className="rounded-2xl bg-surface p-4">
              <DangerZone activeProgram={activeProgram} />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
