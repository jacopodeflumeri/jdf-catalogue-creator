import { Suspense } from 'react';
import Loading from '@/components/ui/Loading';
import { config } from '@/config';
import { getAppBranding } from '@/config/branding';
import AdminSignInClient from './AdminSignInClient';

export const dynamic = 'force-dynamic';

export default function AdminSignIn() {
  const internalProvider = config.keycloak.enabled ? 'keycloak' : 'azure-ad';

  return (
    <Suspense fallback={<Loading />}>
      <AdminSignInClient
        appName={getAppBranding().name}
        internalProvider={internalProvider}
        keycloakIdpHint={config.keycloak.idpHint}
        keycloakCompanyIdpHint={config.keycloak.companyIdpHint}
        devAuthEnabled={config.devAuth.enabled}
      />
    </Suspense>
  );
}
