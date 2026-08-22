import { Download, LogOut } from "lucide-react";
import { getUser } from "@/lib/auth";
import { getUnit, getAccent } from "@/lib/settings";
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
  const [user, unit, accent, logs, profile, active, notifications, evalGate] =
    await Promise.all([
      getUser(),
      getUnit(),
      getAccent(),
      getBodyweightLog(),
      getProfile(),
      getActiveProgramProgress(),
      getNotificationState(),
      getEvalGate(),
    ]);

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
    <div className="mx-auto max-w-2xl">
      <ProfileIdentity
        name={profile?.display_name ?? googleName}
        ringName={profile?.username ?? null}
        email={user?.email ?? null}
        avatarUrl={avatarUrl}
        tier={getTier(profile?.tier)}
        className="mb-8"
      />

      <div className="grid gap-7">
        <section>
          <h2 className="px-1 pb-2 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
            Strength rank
          </h2>
          <TierEvaluator
            currentTierKey={profile?.tier ?? null}
            rationale={profile?.tier_rationale ?? null}
            evaluatedAt={profile?.tier_evaluated_at ?? null}
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

        <SettingsGroup
          label="Preferences"
          caption="Weights are always stored in kg and converted for display."
        >
          <SettingsRow label="Units" control={<UnitToggle current={unit} />} />
          <SettingsRow
            label="Accent"
            hint="Fly the colours of a Kengan Association company."
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

        <section>
          <h2 className="px-1 pb-2 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
            Bodyweight
          </h2>
          <div className="grid gap-4 rounded-lg border border-border bg-surface p-4">
            <BodyweightChart logs={logs} unit={unit} />
            <BodyweightManager logs={logs} unit={unit} />
          </div>
          <p className="px-1 pt-2 text-[12px] leading-5 text-muted">
            Tracked over time, and fed into your strength evaluation.
          </p>
        </section>

        <SettingsGroup label="Account">
          <SettingsRow
            label="Export your data"
            hint="Every logged set as a CSV, weights in kg."
            control={
              <a
                href="/api/export"
                download
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text transition-colors hover:border-accent/40 hover:text-accent"
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
                  className="inline-flex items-center gap-2 rounded-lg border border-danger/30 px-3 py-2 text-sm text-danger transition-colors hover:bg-danger/10"
                >
                  <LogOut className="size-4" />
                  Sign out
                </button>
              </form>
            }
          />
        </SettingsGroup>

        <section>
          <h2 className="px-1 pb-2 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-danger/80">
            Danger zone
          </h2>
          <div className="rounded-lg border border-danger/25 bg-surface p-4">
            <DangerZone activeProgram={activeProgram} />
          </div>
        </section>
      </div>
    </div>
  );
}
