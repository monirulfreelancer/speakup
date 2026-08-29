"use client";

import { useState, useTransition } from "react";
import { connectGoogle, disconnectGoogle } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";

/*
 * Connect or disconnect Google on an existing account. This is the route
 * out of the collision case: someone whose email already had a password
 * signs in with the password, then links Google here.
 */
export function GoogleAccount({ connected }: { connected: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-2">
      <div className="flex min-h-11 items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Google</p>
          <p className="text-xs text-muted">
            {connected ? "Connected — you can sign in with Google" : "Not connected"}
          </p>
        </div>
        {connected ? (
          <Button
            variant="secondary"
            size="sm"
            loading={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const result = await disconnectGoogle().catch(() => ({
                  ok: false as const,
                  error: "Could not disconnect. Try again.",
                }));
                if (!result.ok) setError(result.error);
              })
            }
          >
            Disconnect
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            loading={pending}
            onClick={() => start(async () => void (await connectGoogle()))}
          >
            Connect
          </Button>
        )}
      </div>
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
    </div>
  );
}
