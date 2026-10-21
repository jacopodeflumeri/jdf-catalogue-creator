/**
 * Detects Next.js App Router control-flow "errors".
 *
 * `notFound()`, `redirect()`, and the HTTP-error helpers work by THROWING a
 * special error that React/Next catches up the tree to render a 404, perform a
 * redirect, etc. A custom React error boundary that catches everything will
 * swallow these signals and render its generic fallback instead — so a
 * `notFound()` becomes "Something went wrong" rather than a real 404, and a
 * `redirect()` silently dies.
 *
 * Every custom error boundary MUST detect these and let them propagate: skip
 * them in `componentDidCatch`, and re-`throw` them from `render()` so Next can
 * handle them. The signal is carried on `error.digest`.
 *
 * Note: this is only needed for CUSTOM React error boundaries (class components
 * wrapping content). The framework-managed segment `error.tsx` already excludes
 * control-flow signals, so it does not need this guard.
 */
export function isNextControlFlowError(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return (
    typeof digest === "string" &&
    (digest.startsWith("NEXT_HTTP_ERROR_FALLBACK") ||
      digest.startsWith("NEXT_REDIRECT") ||
      digest === "NEXT_NOT_FOUND")
  );
}
