"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, Loader2, Send, Share, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  deletePushSubscription,
  savePushSubscription,
  sendTestPush,
  setReminderHour,
} from "@/lib/actions/push";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function formatHour(h: number): string {
  const ampm = h < 12 ? "AM" : "PM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:00 ${ampm}`;
}

type Status = "loading" | "unsupported" | "ios-install" | "ready";

export function NotificationsManager({
  reminderHour,
  vapidPublicKey,
}: {
  reminderHour: number | null;
  vapidPublicKey: string;
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [subscribed, setSubscribed] = useState(false);
  const [hour, setHour] = useState<number | null>(reminderHour);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [, startSaving] = useTransition();

  useEffect(() => {
    let cancelled = false;
    const detect = async () => {
      const supported =
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;
      if (!supported) {
        const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent);
        const standalone =
          window.matchMedia?.("(display-mode: standalone)").matches ||
          (navigator as unknown as { standalone?: boolean }).standalone === true;
        if (!cancelled) {
          setStatus(isIOS && !standalone ? "ios-install" : "unsupported");
        }
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) setSubscribed(!!sub);
      } catch {
        // ignore — treat as not subscribed
      }
      if (!cancelled) setStatus("ready");
    };
    void detect();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    if (!vapidPublicKey) {
      setMsg("Push isn't configured on the server yet.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setMsg("Notifications are blocked — allow them in your device settings.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        }));
      const json = sub.toJSON();
      await savePushSubscription({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        userAgent: navigator.userAgent.slice(0, 500),
      });
      setSubscribed(true);
      if (hour == null) {
        setHour(18);
        await setReminderHour({ hour: 18 });
      }
      setMsg("Notifications on. We'll nudge you when it's time to train.");
    } catch {
      setMsg("Couldn't enable notifications. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscription({ endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      setMsg("Notifications turned off on this device.");
    } catch {
      setMsg("Couldn't turn off. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setMsg(null);
    const r = await sendTestPush();
    setBusy(false);
    setMsg(
      r.ok
        ? "Test sent — check your notifications."
        : r.error === "no_subscription"
          ? "Enable notifications on this device first."
          : r.error === "not_configured"
            ? "Push isn't configured on the server yet."
            : "Couldn't send the test. Try again.",
    );
  }

  function changeHour(value: number | null) {
    setHour(value);
    startSaving(async () => {
      await setReminderHour({ hour: value });
    });
  }

  if (status === "loading") {
    return (
      <div className="flex h-10 items-center text-sm text-muted">
        <Loader2 className="mr-2 size-4 animate-spin" /> Checking support…
      </div>
    );
  }

  if (status === "unsupported") {
    return (
      <p className="text-sm text-muted">
        This browser doesn&apos;t support push notifications.
      </p>
    );
  }

  if (status === "ios-install") {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-2/40 p-4">
        <Smartphone className="mt-0.5 size-5 shrink-0 text-accent" />
        <div className="text-sm text-muted">
          <p className="font-medium text-text">Add to Home Screen first</p>
          <p className="mt-1">
            On iPhone, notifications only work in the installed app. Tap{" "}
            <Share className="inline size-3.5 align-text-bottom" /> Share →{" "}
            <span className="text-text">Add to Home Screen</span>, then open Hell
            Blazer from its icon and come back here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {!subscribed ? (
        <div className="flex flex-col gap-2">
          <Button onClick={enable} disabled={busy} className="w-full sm:w-auto">
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Bell className="size-4" />
            )}
            Enable notifications
          </Button>
          <p className="text-xs text-muted">
            A daily nudge when your programmed workout is due — nothing else.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 text-sm text-text">
            <span className="flex size-6 items-center justify-center rounded-md border border-accent/40 bg-accent/10 text-accent">
              <Bell className="size-3.5" />
            </span>
            Notifications are on for this device.
          </div>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted">
              Daily workout reminder
            </span>
            <Select
              value={hour == null ? "off" : String(hour)}
              onChange={(e) =>
                changeHour(e.target.value === "off" ? null : Number(e.target.value))
              }
              className="sm:w-56"
            >
              <option value="off">Off</option>
              {Array.from({ length: 24 }).map((_, h) => (
                <option key={h} value={h}>
                  {formatHour(h)}
                </option>
              ))}
            </Select>
            <span className="text-xs text-muted">
              Fires only on days a workout is due and not yet logged.
            </span>
          </label>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={test} disabled={busy}>
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Send test
            </Button>
            <Button variant="ghost" size="sm" onClick={disable} disabled={busy}>
              Turn off
            </Button>
          </div>
        </>
      )}

      {msg && <p className="text-xs text-muted">{msg}</p>}
    </div>
  );
}
