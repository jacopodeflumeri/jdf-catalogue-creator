'use client';

import { useEffect, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Loading from '@/components/ui/Loading';
import Icon from '@/components/ui/Icon';
import logger from '@/lib/utils/logger';
import AppIdentity from '@/components/shared/layout/AppBranding';
import { resolveCallbackUrl } from '@/modules/auth/lib/callback-url';

type AdminSignInClientProps = {
  appName: string;
  internalProvider: 'keycloak' | 'azure-ad';
  keycloakIdpHint?: string;
  keycloakCompanyIdpHint?: string;
  /** Local dev login bypass is on (never in production) — show its link. */
  devAuthEnabled?: boolean;
};

export default function AdminSignInClient({
  appName,
  internalProvider,
  keycloakIdpHint,
  keycloakCompanyIdpHint,
  devAuthEnabled = false,
}: AdminSignInClientProps) {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeLogin, setActiveLogin] = useState<'internal' | 'company' | null>(null);

  const errorParam = searchParams.get('error');
  const messageParam = searchParams.get('message');
  // The page the visitor was on when sent here (NextAuth's middleware adds it),
  // so a bookmark lands where it points rather than on the area's root.
  const requestedUrl = searchParams.get('callbackUrl');

  useEffect(() => {
    // if (status === 'authenticated') {
    //   router.push('/admin');
    // }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <Loading size="lg" text="Loading..." />
      </div>
    );
  }

  const handleLogin = async (loginTarget: 'internal' | 'company') => {
    setActiveLogin(loginTarget);
    try {
      const hintedIdp = internalProvider === 'keycloak'
        ? loginTarget === 'company'
          ? keycloakCompanyIdpHint
          : keycloakIdpHint
        : undefined;
      const authorizationParams =
        internalProvider === 'keycloak'
          ? {
              ...(hintedIdp ? { kc_idp_hint: hintedIdp } : {}),
              ...(loginTarget === 'internal' ? { prompt: 'login' } : {}),
              ...(loginTarget === 'company' ? { scope: 'openid profile' } : {}),
            }
          : undefined;

      // Company Login resolves to a customer session; send them to the customer
      // area, not /admin (requireAdmin would bounce a customer back to login).
      // Within that area, honour the requested page — same-origin only.
      const callbackUrl = resolveCallbackUrl(
        requestedUrl,
        loginTarget === 'company' ? 'account' : 'admin',
        window.location.origin,
      );
      await signIn(internalProvider, { callbackUrl }, authorizationParams);
    } catch (error) {
      logger.error('Internal login failed:', error);
      setActiveLogin(null);
    }
  };

  // Each KC button is conditional on the corresponding *_IDP_HINT env var.
  // Apps that want a single-button experience can delete the hint they don't
  // need from their per-app SSM (see docs/template/KEYCLOAK.md).
  // Internal button always shows for the legacy Azure path (where internalProvider==='azure-ad').
  const hasInternalLogin = internalProvider !== 'keycloak' || Boolean(keycloakIdpHint);
  const hasCompanyLogin = internalProvider === 'keycloak' && Boolean(keycloakCompanyIdpHint);
  const internalButtonLabel = internalProvider === 'keycloak' ? 'Mapp Entra ID' : 'Internal Login';

  return (
    <div className="flex-1 flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center">
            <AppIdentity compact />
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
            {appName} Login
          </h2>
        </div>

        <div className="mt-8 space-y-6">
          {(errorParam === 'SSORrequired' || messageParam) && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-4 text-center">
              <div className="flex flex-col text-center items-center justify-center">
                <Icon type="warning" className="text-amber-400 mr-3 mt-0.5" size="md" />
                <div>
                  <p className="text-sm text-amber-700 mt-1">
                    {messageParam || 'Please use the sign in button below for admin access.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {hasCompanyLogin ? (
              <Button
                onClick={() => handleLogin('company')}
                variant="primary"
                className="w-full flex items-center justify-center"
                disabled={activeLogin !== null}
              >
                {activeLogin === 'company' ? (
                  <>
                    <Loading size="sm" text="" className="mr-2" />
                    Signing In...
                  </>
                ) : (
                  <>
                    <Icon type="shield" className="mr-2" size="md" />
                    Company Login
                  </>
                )}
              </Button>
            ) : null}

            {hasInternalLogin ? (
              <Button
                onClick={() => handleLogin('internal')}
                variant={hasCompanyLogin ? 'override' : 'primary'}
                className={`w-full flex items-center justify-center${
                  hasCompanyLogin
                    ? ' border border-[rgba(141,119,247,0.26)] bg-[linear-gradient(135deg,rgba(246,242,255,0.98),rgba(224,214,255,0.92))] text-[rgba(93,70,208,0.98)] shadow-[0_12px_30px_rgba(141,119,247,0.10)] hover:border-[rgba(141,119,247,0.34)] hover:bg-[linear-gradient(135deg,rgba(248,244,255,1),rgba(232,223,255,0.96))] hover:text-[rgba(84,61,196,1)]'
                    : ''
                }`}
                disabled={activeLogin !== null}
              >
                {activeLogin === 'internal' ? (
                  <>
                    <Loading size="sm" text="" className="mr-2" />
                    Signing In...
                  </>
                ) : (
                  <>
                    <Icon type="shield" className="mr-2" size="md" />
                    {internalButtonLabel}
                  </>
                )}
              </Button>
            ) : null}
          </div>

          {devAuthEnabled ? (
            <div className="text-center">
              <Link
                href={
                  requestedUrl
                    ? `/auth/dev?callbackUrl=${encodeURIComponent(requestedUrl)}`
                    : '/auth/dev'
                }
                className="text-xs text-[#7D581C] hover:underline"
              >
                Developer login (local only)
              </Link>
            </div>
          ) : null}

          {/* The "Back to customer login" link only makes sense in legacy
              Azure-only mode where /auth/signin is the magic-link customer
              form. When Keycloak is active, /auth/signin server-redirects
              back to /auth/admin, so the link is a no-op. */}
          {internalProvider !== 'keycloak' ? (
            <div className="text-center">
              <Link
                href="/auth/signin"
                className="text-sm text-primary-600 hover:text-primary-500"
              >
                ← Back to customer login
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
