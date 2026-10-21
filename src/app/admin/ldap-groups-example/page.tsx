import { notFound } from 'next/navigation';
import { requireAdmin } from '@/modules/auth/server';
import { config } from '@/config';

function toSlug(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function hasGroup(groups: string[], expected: string) {
  return groups.includes(expected);
}

function hasPrefix(groups: string[], expectedPrefix: string) {
  return groups.some((group) => group.startsWith(expectedPrefix));
}

export default async function AdminLdapGroupsExamplePage() {
  // Same gate as /admin/auth-debug: a developer aid, off by default in
  // production (AUTH_DEBUG_ENABLED=true turns it on), still admin-only.
  if (!config.authDebug.enabled) {
    notFound();
  }
  const session = await requireAdmin({ redirectTo: '/auth/admin' });
  const mappLdapGroups = session.user.mappLdapGroups ?? [];
  const appSlug = toSlug(config.app.name || 'labs-app');

  const exampleRules = {
    globalLabsAdmin: hasGroup(mappLdapGroups, 'LABS-ADMIN'),
    appAdmin: hasGroup(mappLdapGroups, `LABS-${appSlug}-ADMIN`),
    appRead: hasGroup(mappLdapGroups, `LABS-${appSlug}-READ`),
    productDepartment: hasPrefix(mappLdapGroups, 'LABS-PRODUCT'),
  };

  const derivedAccess = exampleRules.globalLabsAdmin || exampleRules.appAdmin
    ? 'admin'
    : exampleRules.appRead
      ? 'viewer'
      : 'none';

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-bold text-gray-900">LDAP Groups Example</h1>
        <p className="max-w-3xl text-sm text-gray-600">
          This page is only an example of how an app owner could interpret <code>mappLdapGroups</code>.
          The platform forwards raw groups, but the meaning of those groups stays app-owned.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Session Inputs</h2>
          <pre className="overflow-x-auto whitespace-pre-wrap text-sm text-gray-800">
            {JSON.stringify(
              {
                email: session.user.email,
                authSource: session.user.authSource,
                identityProvider: session.user.identityProvider,
                mappLdapGroups,
              },
              null,
              2
            )}
          </pre>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Example Rule Evaluation</h2>
          <pre className="overflow-x-auto whitespace-pre-wrap text-sm text-gray-800">
            {JSON.stringify(
              {
                expectedGroups: {
                  globalLabsAdmin: 'LABS-ADMIN',
                  appAdmin: `LABS-${appSlug}-ADMIN`,
                  appRead: `LABS-${appSlug}-READ`,
                  productDepartmentPrefix: 'LABS-PRODUCT',
                },
                matches: exampleRules,
                derivedAccess,
              },
              null,
              2
            )}
          </pre>
        </div>
      </section>

      <section className="rounded-lg border border-blue-200 bg-blue-50 p-6">
        <h2 className="mb-3 text-lg font-semibold text-blue-900">Suggested Usage Pattern</h2>
        <ul className="list-disc space-y-2 pl-6 text-sm text-blue-900">
          <li>Keep Keycloak responsible only for forwarding raw LDAP groups.</li>
          <li>Let each Labs app decide which groups unlock admin, read-only, or feature-specific access.</li>
          <li>Optionally sync group-derived decisions into local app state like <code>MappTeam.accessLevel</code>.</li>
        </ul>
      </section>
    </main>
  );
}
