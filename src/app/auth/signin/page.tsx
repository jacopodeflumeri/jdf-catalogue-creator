import { redirect } from 'next/navigation';
import { config } from '@/config';
import LegacySignInClient from './LegacySignInClient';
import {
  type RedirectSearchParams,
  withPreservedSearchParams,
} from '@/app/_lib/preserve-search-params';

export const dynamic = 'force-dynamic';

/**
 * Sign-in entry.
 *
 * The legacy magic-link form is an OPTIONAL capability (config.magicLink),
 * cleanly decoupled from the Keycloak path. It renders here ONLY when
 * MAGIC_LINK_ENABLED=true. Otherwise every request bounces to `/auth/admin`,
 * the unified entry point (Mapp Entra ID / Company Login under Keycloak).
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<RedirectSearchParams>;
}) {
  if (!config.magicLink.enabled) {
    // The whole query is forwarded — including repeated keys. NextAuth puts the
    // page the visitor asked for in `callbackUrl`; /auth/admin honours it, so a
    // bookmark survives an expired session instead of landing on the dashboard.
    redirect(withPreservedSearchParams('/auth/admin', await searchParams));
  }

  return <LegacySignInClient />;
}
