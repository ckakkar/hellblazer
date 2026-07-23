import { LogOut } from "lucide-react";
import { getUser } from "@/lib/auth";
import { getUnit } from "@/lib/settings";
import { getBodyweightLog } from "@/lib/data/bodyweight";
import { getProfile } from "@/lib/data/profile";
import { getActiveProgramProgress } from "@/lib/data/programs";
import { getNotificationState } from "@/lib/data/push";
import { signOut } from "@/lib/actions/auth";
import { PageHeader, SectionLabel } from "@/components/ui/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UnitToggle } from "./unit-toggle";
import { BodyweightManager } from "./bodyweight-manager";
import { NotificationsManager } from "./notifications-manager";
import { TierEvaluator } from "./tier-evaluator";
import { DangerZone } from "./danger-zone";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const [user, unit, logs, profile, active, notifications] = await Promise.all([
    getUser(),
    getUnit(),
    getBodyweightLog(),
    getProfile(),
    getActiveProgramProgress(),
    getNotificationState(),
  ]);

  const activeProgram = active
    ? { id: active.program.id, name: active.program.name }
    : null;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Profile"
        subtitle="Your rank, your settings, your reset switches."
      />

      <div className="grid gap-6">
        <section>
          <SectionLabel>Strength rank</SectionLabel>
          <TierEvaluator
            currentTierKey={profile?.tier ?? null}
            rationale={profile?.tier_rationale ?? null}
            evaluatedAt={profile?.tier_evaluated_at ?? null}
          />
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Units</CardTitle>
            <CardDescription>
              Weights are always stored in kg and converted for display.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UnitToggle current={unit} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>
              A daily push reminder when your programmed workout is due.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NotificationsManager
              reminderHour={notifications.reminderHour}
              vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bodyweight log</CardTitle>
            <CardDescription>
              Track bodyweight over time — it feeds your strength evaluation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BodyweightManager logs={logs} unit={unit} />
          </CardContent>
        </Card>

        <Card className="border-danger/20">
          <CardHeader>
            <CardTitle>Reset &amp; danger zone</CardTitle>
            <CardDescription>
              Restart your current block or wipe your logged history.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DangerZone activeProgram={activeProgram} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>{user?.email}</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={signOut}>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg border border-danger/30 px-4 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/10"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
