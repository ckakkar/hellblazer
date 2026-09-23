import { Download, LogOut } from "lucide-react";
import { getUser } from "@/lib/auth";
import { format, parseISO } from "date-fns";
import { getUnit, getAccent, getTimeZone, getToday } from "@/lib/settings";
import { dateInTimeZone } from "@/lib/local-date";
import { getBodyweightLog } from "@/lib/data/bodyweight";
import { getProfile } from "@/lib/data/profile";
import { getEvalGate } from "@/lib/data/evaluation";
import { getActiveProgramProgress } from "@/lib/data/programs";
import { getNotificationState } from "@/lib/data/push";
import { signOut } from "@/lib/actions/auth";
import { getTier } from "@/lib/tiers";
import { ProfileIdentity } from "@/components/tier/profile-identity";
import {
  SettingsGroup,
  SettingsRow,
} from "@/components/ui/settings-list";
import { UnitToggle } from "./unit-toggle";
import { ThemeSelector } from "./theme-selector";
import { ProfileDetails } from "./profile-details";
import { UsernameField } from "./username-field";
import { BodyweightManager } from "./bodyweight-manager";
import { BodyweightChart } from "@/components/charts/bodyweight-chart";
import { NotificationsManager } from "./notifications-manager";
import { TierEvaluator } from "./tier-evaluator";
import { DangerZone } from "./danger-zone";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const [user, unit, accent, logs, profile, active, notifications, evalGate, tz, today] =
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
    ]);

  // Formatted here, in the lifter's timezone: a client component formatting
  // the timestamp itself renders differently on the server and the phone.
  const evaluatedLabel = profile?.tier_evaluated_at
    ? format(parseISO(dateInTimeZone(new Date(profile.tier_evaluated_at), tz)), "d MMM yyyy")
    : null;

  const activeProgram = active
    ? { id: active.program.id, name: active.program.name }
    : null;

  // Google is the only sign-in method, so the account picture and name are the
  // best identity we have; the profile row overrides them once it's filled in.
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

  return (
    <div>
      <ProfileIdentity
        name={profile?.display_name ?? googleName}
        ringName={profile?.username ?? null}
        email={user?.email ?? null}
        avatarUrl={avatarUrl}
        tier={getTier(profile?.tier)}
        className="mb-10"
      />

      <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
        <div className="grid gap-10 lg:col-span-7">
        <section>
          <h2 className="px-4 pb-2 text-[13px] font-medium text-muted">Strength rank</h2>
          <TierEvaluator
            currentTierKey={profile?.tier ?? null}
            rationale={profile?.tier_rationale ?? null}
            evaluatedLabel={evaluatedLabel}
            gate={evalGate}
          />
        </section>

        <SettingsGroup
          label="About you"
          caption="Your ring name shows on King of the Hill. The rest calibrates your strength rank."
        >
          <SettingsRow label="Ring name">
            <UsernameField current={profile?.username ?? null} />
          </SettingsRow>
          <SettingsRow label="Details">
            <ProfileDetails
              displayName={profile?.display_name ?? null}
              sex={(profile?.sex as "male" | "female" | "other" | null) ?? null}
              age={
                profile?.birth_year
                  ? new Date().getFullYear() - profile.birth_year
                  : null
              }
              heightCm={profile?.height_cm ?? null}
            />
          </SettingsRow>
        </SettingsGroup>

        <section>
          <h2 className="px-4 pb-2 text-[13px] font-medium text-muted">Bodyweight</h2>
          <div className="grid gap-4 rounded-2xl bg-surface p-4">
            <BodyweightChart logs={logs} unit={unit} />
            <BodyweightManager logs={logs} unit={unit} today={today} />
          </div>
          <p className="px-4 pt-2 text-[13px] leading-5 text-muted">
            Used by the judge to rank you relative to your size.
          </p>
        </section>
        </div>

        <aside className="grid gap-10 lg:col-span-5 lg:sticky lg:top-8">
        <SettingsGroup
          label="Preferences"
          caption="Weights are always stored in kg and converted for display."
        >
          <SettingsRow label="Units" control={<UnitToggle current={unit} />} />
          <SettingsRow
            label="Accent"
            hint="Named after the Kengan Association companies."
          >
            <ThemeSelector current={accent} />
          </SettingsRow>
        </SettingsGroup>

        <SettingsGroup
          label="Notifications"
          caption="A daily push reminder when your programmed workout is due."
        >
          <SettingsRow label="Daily reminder">
            <NotificationsManager
              reminderHour={notifications.reminderHour}
              vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
            />
          </SettingsRow>
        </SettingsGroup>

        <SettingsGroup label="Account">
          <SettingsRow
            label="Export your data"
            hint="Every logged set as a CSV, weights in kg."
            control={
              <a
                href="/api/export"
                download
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-surface-2 px-3.5 text-[14px] font-medium text-text transition-colors hover:bg-[#242428]"
              >
                <Download className="size-4" />
                Export
              </a>
            }
          />
          <SettingsRow
            label="Signed in"
            hint={user?.email ?? undefined}
            control={
              <form action={signOut}>
                <button
                  type="submit"
                  className="inline-flex h-9 items-center gap-2 rounded-xl bg-danger/10 px-3.5 text-[14px] font-medium text-danger transition-colors hover:bg-danger/15"
                >
                  <LogOut className="size-4" />
                  Sign out
                </button>
              </form>
            }
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
