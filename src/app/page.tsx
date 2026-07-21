import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { Activity, BarChart3, Dumbbell, Target } from "lucide-react";

const FEATURES = [
  {
    icon: Dumbbell,
    title: "Template-driven",
    body: "Build your split once. Instantiate a session in a tap.",
  },
  {
    icon: Activity,
    title: "Fast logging",
    body: "Copy-forward sets, big tap targets, last-time targets inline.",
  },
  {
    icon: BarChart3,
    title: "Instrumented",
    body: "Est. 1RM, volume and weekly sets-per-muscle, computed live.",
  },
  {
    icon: Target,
    title: "Weak-point aware",
    body: "Back · biceps · triceps · side delts, tracked every week.",
  },
];

export default async function Landing() {
  const user = await getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      {/* ambient accent glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full opacity-40 blur-[120px]"
        style={{
          background:
            "radial-gradient(closest-side, rgba(0,229,199,0.22), transparent)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 0%, black, transparent)",
        }}
      />

      <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col px-6">
        <header className="flex items-center gap-2 py-6">
          <div className="flex size-7 items-center justify-center rounded-md bg-accent text-bg shadow-glow">
            <Dumbbell className="size-4" />
          </div>
          <span className="font-mono text-sm font-semibold tracking-[0.2em] text-text">
            OVERLOAD
          </span>
        </header>

        <section className="flex flex-1 flex-col justify-center py-16">
          <span className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-muted">
            <span className="size-1.5 animate-pulse rounded-full bg-accent" />
            Progressive overload, instrumented
          </span>
          <h1 className="max-w-2xl text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-text sm:text-6xl">
            Your training,{" "}
            <span className="text-accent">measured to the set.</span>
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-base leading-7 text-muted sm:text-lg">
            A precision workout tracker built around a fast mid-workout logger
            and a live analytics engine. Log the set, watch the numbers move.
          </p>

          <div className="mt-9">
            <GoogleSignIn />
            <p className="mt-3 text-xs text-muted">
              Google sign-in only. Your data is yours — isolated per account.
            </p>
          </div>

          <dl className="mt-16 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-surface p-5">
                <f.icon className="size-5 text-accent" />
                <dt className="mt-3 text-sm font-medium text-text">
                  {f.title}
                </dt>
                <dd className="mt-1 text-sm leading-6 text-muted">{f.body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <footer className="py-6 text-xs text-muted">
          Built on Next.js + Supabase · RLS-isolated multi-user
        </footer>
      </div>
    </main>
  );
}
