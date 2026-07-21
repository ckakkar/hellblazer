import { LogOut } from "lucide-react";
import { getUser } from "@/lib/auth";
import { getUnit } from "@/lib/settings";
import { getBodyweightLog } from "@/lib/data/bodyweight";
import { signOut } from "@/lib/actions/auth";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardDescription } from "@/components/ui/card";
import { UnitToggle } from "./unit-toggle";
import { BodyweightManager } from "./bodyweight-manager";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [user, unit, logs] = await Promise.all([
    getUser(),
    getUnit(),
    getBodyweightLog(),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" />

      <div className="grid gap-4">
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
            <CardTitle>Bodyweight log</CardTitle>
            <CardDescription>
              Track bodyweight over time in your chosen unit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BodyweightManager logs={logs} unit={unit} />
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
