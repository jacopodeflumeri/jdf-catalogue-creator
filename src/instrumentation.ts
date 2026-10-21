import type { Instrumentation } from "next";

/**
 * Server-side hook invoked for every error thrown during request handling —
 * including Server Component / SSR render errors caught by an `error.tsx`
 * boundary, whose message is stripped from production client bundles. Without
 * this hook those errors never reach our server logs (CloudWatch).
 *
 * Uses raw `console.error` (not the app logger) on purpose: this must emit even
 * for very early/low-level failures, and the structured logger may not be
 * initialized in every runtime/edge context. The `digest` here correlates with
 * the `digest` shown by the client `error.tsx` and logged by `onRequestError`.
 */
export const onRequestError: Instrumentation.onRequestError = (
  err,
  request,
  context,
) => {
  const e = err as { message?: string; stack?: string; digest?: string };
  console.error(
    "[onRequestError]",
    JSON.stringify({
      message: e?.message,
      digest: e?.digest,
      path: request?.path,
      routePath: context?.routePath,
      routeType: context?.routeType,
      renderSource: context?.renderSource,
    }),
  );
  // Stack separately so it isn't truncated inside the JSON envelope.
  if (e?.stack) console.error("[onRequestError:stack]", e.stack);
};
