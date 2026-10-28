import type { Metadata } from "next";
import { CONTACT_EMAIL, LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Fatty stores, who sees it, and how to delete it.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="19 October 2026">
      <p className="text-text">
        Fatty keeps your training data so it can show it back to you. It isn&apos;t sold, used for
        advertising, or used to track you across other apps and sites.
      </p>

      <section>
        <h2>What Fatty stores</h2>
        <ul>
          <li>
            <strong>Your account:</strong> your name, email address and account ID from Google or
            Apple. If you choose Hide My Email with Apple, Fatty only sees Apple&apos;s relay address.
          </li>
          <li>
            <strong>Your training:</strong> workouts, exercises, sets, programs, templates, notes and
            bodyweight, plus any profile details you add: birthday, sex, height and ring name.
          </li>
          <li>
            <strong>Notifications:</strong> if you turn them on, a push token for your browser,
            iPhone or iPad and your time zone, so reminders arrive on the right day.
          </li>
          <li>
            <strong>Sign in with Apple:</strong> a token from Apple, kept only so Fatty can revoke its
            access when you delete your account.
          </li>
        </ul>
      </section>

      <section>
        <h2>Who else sees it</h2>
        <ul>
          <li>
            <strong>Other signed-in lifters</strong> see your ring name, your rank and the total
            weight you&apos;ve lifted on King of the Hill, and only if you set a ring name. Your
            name, email, measurements and workouts are never shown to anyone else.
          </li>
          <li>
            <strong>The strength judge:</strong> when you ask for a rank, a summary of your training is
            sent to DeepSeek&apos;s AI, which decides the rank: each lift&apos;s name and best numbers,
            how often and how much you train, your program&apos;s name and week, and the profile
            details you&apos;ve added (sex, age, height, bodyweight). Never your name or email.
            Nothing is sent unless you ask.
          </li>
          <li>
            <strong>The services that run Fatty:</strong> Supabase (database and sign-in, hosted in
            Tokyo), Vercel (web hosting), Google and Apple (sign-in), and Apple&apos;s push service
            (app notifications). They process data only to provide those services.
          </li>
        </ul>
      </section>

      <section>
        <h2>Apple Health</h2>
        <p>
          In the iPhone and iPad app, if you turn on Apple Health in Settings, Fatty saves your finished
          workouts, how hard they were (from the RPE you log), and the bodyweight you log to Health.
          If you connect Recovery, Fatty reads your sleep, heart rate variability and resting heart
          rate, and the workouts your Apple Watch recorded, to show how recovered you are. If you
          connect heart rate, Fatty reads your Apple Watch&apos;s heart rate during a workout to show
          how hard it was and how you recovered between sets, and Apple&apos;s on-device model writes
          a short summary of it. Those readings are used on your device only: they are never sent
          to Fatty&apos;s servers or anyone else. Anything involving Health is not used for advertising and not shared with
          anyone. You can switch it off in Fatty, or in the Health app under Sharing → Apps → Fatty.
        </p>
      </section>

      <section>
        <h2>Cookies and tracking</h2>
        <p>
          Fatty&apos;s cookies keep you signed in and remember your own settings on this device: your
          units, accent colour, light or dark, and time zone (so &quot;today&quot; is your today). The
          logger also keeps unsaved sets on your device until they reach the server. There are no
          ads, no analytics services and no tracking.
        </p>
      </section>

      <section>
        <h2>Your data, your call</h2>
        <ul>
          <li>Download every set you&apos;ve logged as a CSV file from Settings.</li>
          <li>Wipe your training history from Settings at any time.</li>
          <li>
            Delete your account from Settings: your account and everything in it are removed straight
            away, and Apple sign-in access is revoked.
          </li>
        </ul>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Questions about your data: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </section>
    </LegalPage>
  );
}
