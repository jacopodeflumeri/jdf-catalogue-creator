export type RedirectSearchParams = Record<
  string,
  string | string[] | undefined
>;

/**
 * Append every supplied query value to a canonical redirect target.
 *
 * For server pages that redirect to another route but must keep the query —
 * e.g. /auth/signin forwarding NextAuth's `callbackUrl`. Repeated keys
 * (`?tag=a&tag=b`, which Next delivers as an array) are kept, in order; only
 * absent values are dropped.
 */
export function withPreservedSearchParams(
  pathname: string,
  searchParams: RedirectSearchParams,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, item));
    } else if (value !== undefined) {
      query.set(key, value);
    }
  }
  const serialized = query.toString();
  return serialized ? `${pathname}?${serialized}` : pathname;
}
