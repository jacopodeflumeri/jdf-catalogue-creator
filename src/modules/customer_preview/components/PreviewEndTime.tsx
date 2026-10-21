"use client";

import { useSyncExternalStore } from "react";
import { formatPreviewEndTime } from "../lib/format";

/** The end time never changes while mounted; there is nothing to subscribe to. */
const subscribeNever = () => () => {};

/**
 * " · ends 14:30", in the BROWSER's time zone — and nothing on the server.
 *
 * Why this is its own client island: formatting a time during render prints
 * the server's zone (the container runs in UTC) in the server HTML and the
 * browser's zone on hydration — a React hydration mismatch on every preview
 * page. `useSyncExternalStore` with a `null` SERVER snapshot makes the server
 * render and the hydrating render agree (both empty); React then re-renders
 * with the client snapshot. Do not "simplify" this into a plain
 * `toLocaleTimeString()` in the banner.
 */
export default function PreviewEndTime({ expiresAt }: { expiresAt: string }) {
  const label = useSyncExternalStore(
    subscribeNever,
    () => formatPreviewEndTime(expiresAt),
    () => null,
  );
  if (!label) return null;
  return (
    <>
      {" · ends "}
      <time dateTime={expiresAt}>{label}</time>
    </>
  );
}
