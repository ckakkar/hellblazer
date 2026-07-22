"use client";

import { useState, useTransition } from "react";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resetProgram } from "@/lib/actions/programs";
import { clearHistory } from "@/lib/actions/sessions";

export function DangerZone({
  activeProgram,
}: {
  activeProgram: { id: string; name: string } | null;
}) {
  const [pending, start] = useTransition();
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <div className="grid gap-4">
      {activeProgram && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium text-text">Restart block</div>
            <p className="text-xs text-muted">
              Reset “{activeProgram.name}” to week 1 (today). Logged sessions are
              kept.
            </p>
          </div>
          {confirmReset ? (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await resetProgram({ id: activeProgram.id });
                    setConfirmReset(false);
                  })
                }
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RotateCcw className="size-4" />
                )}
                Confirm restart
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmReset(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => setConfirmReset(true)}
            >
              <RotateCcw className="size-4" />
              Restart block
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-medium text-danger">Delete all history</div>
          <p className="text-xs text-muted">
            Permanently wipe every logged session, exercise and set. Cannot be
            undone.
          </p>
        </div>
        {confirmClear ? (
          <div className="flex items-center gap-2">
            <Button
              variant="danger"
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await clearHistory();
                  setConfirmClear(false);
                })
              }
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Wipe everything
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmClear(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="danger"
            size="sm"
            className="shrink-0"
            onClick={() => setConfirmClear(true)}
          >
            <Trash2 className="size-4" />
            Delete history
          </Button>
        )}
      </div>
    </div>
  );
}
