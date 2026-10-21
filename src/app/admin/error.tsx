"use client";

import { useEffect } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";

/**
 * Route-level error boundary for all /admin pages.
 *
 * Catches render/runtime errors within the admin segment and offers a Retry
 * (instead of a dead "Something went wrong"), capturing the error + digest for
 * diagnosis. Server-render errors that reach here are also logged server-side
 * via `onRequestError` (see src/instrumentation.ts) and correlate by `digest`.
 *
 * A common cause is deployment skew: a tab opened against an older build
 * navigates after a redeploy and references RSC/server-action ids that no
 * longer exist. `reset()` re-renders against the current build; "Reload page"
 * forces a fresh GET if a soft reset isn't enough.
 *
 * Note: this does NOT need the `isNextControlFlowError` guard — Next's
 * framework-managed `error.tsx` never receives `notFound()`/`redirect()`
 * signals (those are handled by the framework / `not-found.tsx`).
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Always emit (client console + any attached reporter); server-rendered
    // errors also carry a `digest` that correlates to the server logs.
    console.error("[admin] route error", {
      message: error?.message,
      digest: error?.digest,
      stack: error?.stack,
    });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          This page hit an error while loading. If the app was just deployed,
          retrying usually fixes it.
        </p>
        {error?.digest ? (
          <p className="mt-3 font-mono text-xs text-gray-400">
            Ref: {error.digest}
          </p>
        ) : null}
        <div className="mt-5 flex items-center justify-center gap-3">
          <Button onClick={() => reset()}>Retry</Button>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Reload page
          </Button>
          <Link
            href="/admin"
            className="inline-flex items-center px-4 py-2 text-sm text-primary-600 hover:underline"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
