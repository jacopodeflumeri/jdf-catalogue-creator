import { notFound } from 'next/navigation';
import { requireAdmin } from '@/modules/auth/server';
import { config } from '@/config';
import Icon from '@/components/ui/Icon';
import Tooltip from '@/components/ui/Tooltip';

type WorkspaceDebugEntry = {
  workspaceId?: string;
  accountId?: string | null;
  systemId?: string | null;
  services?: string[];
};

const SERVICE_LABELS: Record<string, string> = {
  AN_EX_API: 'Intelligence API',
  BIZMO: 'Business Monitoring',
  ENGAGE: 'Engage',
  ENGAGE_API: 'Engage API',
  FASHION_API: 'Fashion API',
  GDPR_UDM: 'Data Privacy Compliance Manager',
  GUM: 'Global User Management',
  MAC: 'Marketing Apps',
  MYP: 'My Profile',
  PF: 'Product Feed',
  PF_API: 'PC API',
  Q3V2: 'Intelligence',
  RDS: 'Data Streams',
  SELS: 'Select',
  SETTINGS: 'Settings',
  ST: 'Tag Integration',
  UM: 'User Management',
  URM: 'Segment Manager',
};

const HIDDEN_WORKSPACE_SERVICES = new Set(['UM', 'GUM', 'MYP', 'GDPR_UDM', 'SELS', 'BIZMO']);

export default async function AdminAuthDebugPage() {
  // Gated behind a debug flag (off by default in production), still admin-only.
  if (!config.authDebug.enabled) {
    notFound();
  }
  const session = await requireAdmin({ redirectTo: '/auth/admin' });
  const debugData = {
    role: session.user.role,
    email: session.user.email,
    name: session.user.name,
    adminId: session.user.adminId,
    loginName: session.user.loginName,
    userId: session.user.userId,
    companyId: session.user.companyId,
    tenantId: session.user.tenantId,
    isSuperAdmin: session.user.isSuperAdmin,
    access: session.user.access,
    roles: session.user.roles,
    workspaces: session.user.workspaces,
    isMappEmployee: session.user.isMappEmployee,
    mappLdapGroups: session.user.mappLdapGroups,
    authSource: session.user.authSource,
    identityProvider: session.user.identityProvider,
    keycloakIdpHint: session.user.keycloakIdpHint ?? null,
    accountId: session.user.accountId,
    accountName: session.user.accountName,
  };

  const fieldSections = [
    {
      title: 'Session Summary',
      description: 'Core session values resolved by the app after login, grouped by which side owns them.',
      identity: {
        email: debugData.email,
        name: debugData.name,
        identityProvider: debugData.identityProvider ?? null,
        authSource: debugData.authSource ?? null,
      },
      groups: [
        {
          title: 'Lab App',
          variant: 'lab' as const,
          items: [
            {
              label: 'role',
              value: debugData.role,
              meaning: 'High-level session type used by route protection.',
              expected: '`admin` or `customer`',
            },
            {
              label: 'adminId',
              value: debugData.adminId ?? null,
              meaning: 'Internal Labs admin/team-member identifier.',
            },
            {
              label: 'accountId',
              value: debugData.accountId ?? null,
              meaning: 'Selected customer account context, usually empty for plain admin login.',
            },
            {
              label: 'accountName',
              value: debugData.accountName ?? null,
              meaning: 'Selected customer account display name.',
            },
          ],
        },
        {
          title: 'Mapp Cloud',
          variant: 'cloud' as const,
          items: [
            {
              label: 'loginName',
              value: debugData.loginName ?? null,
              meaning: 'Company-context login name resolved by Keycloak, usually `company_prefix.username`.',
            },
            {
              label: 'userId',
              value: debugData.userId ?? null,
              meaning: 'Company user identifier returned by the Suite/SSO context.',
            },
            {
              label: 'companyId',
              value: debugData.companyId ?? null,
              meaning: 'Customer company identifier used by Client Catalog and related APIs.',
            },
          ],
        },
      ],
    },
    {
      title: 'Authorization',
      description: 'Fields the app should primarily use for authorization decisions, grouped by which side owns them.',
      groups: [
        {
          title: 'Lab App',
          variant: 'lab' as const,
          items: [
            {
              label: 'isSuperAdmin',
              value: debugData.isSuperAdmin,
              meaning: 'Superadmin override flag from env and/or DB state.',
              expected: '`true` or `false`',
            },
            {
              label: 'access',
              value: debugData.access,
              meaning: 'App-level access used by guards and admin/editor checks.',
              expected: '`viewer`, `editor`, or `admin`',
            },
          ],
        },
        {
          title: 'Mapp Cloud',
          variant: 'cloud' as const,
          items: [
            {
              label: 'roles',
              value: debugData.roles ?? [],
              meaning: 'Company-context roles resolved from SSOservice.',
            },
            {
              label: 'workspaces',
              value: debugData.workspaces ?? [],
              meaning: 'Workspace access payload. Services are shown with friendly labels, while a few internal/non-product services are hidden from the table view.',
            },
          ],
        },
      ],
    },
    {
      title: 'Authentication Path',
      description: 'How this session was created and which upstream provider was involved.',
      items: [
        {
          label: 'authSource',
          value: debugData.authSource ?? null,
          meaning: 'Final auth path that produced the session.',
          expected: '`keycloak`, `nextauth-azure`, or `magic-link`',
        },
        {
          label: 'identityProvider',
          value: debugData.identityProvider ?? null,
          meaning: 'Upstream identity source used behind the final Keycloak session.',
          expected: '`entra`, `mapp-cloud`, or `internal`',
        },
        {
          label: 'keycloakIdpHint',
          value: debugData.keycloakIdpHint,
          meaning: 'Actual Keycloak broker hint resolved for this session.',
          expected: '`null` or a Keycloak IdP alias such as `mapp-entra-id` or `mapp-cloud-company`',
        },
      ],
    },
    {
      title: 'LDAP / Identity Data',
      description: 'Raw identity data available for future group-based authorization mapping.',
      items: [
        {
          label: 'isMappEmployee',
          value: debugData.isMappEmployee ?? false,
          meaning: 'Derived flag showing whether the company-context email belongs to the `@mapp.com` domain.',
          expected: '`true` when a Mapp employee logs in with a company-context user.',
        },
        {
          label: 'mappLdapGroups',
          value: debugData.mappLdapGroups ?? [],
          meaning: 'Raw LDAP groups for the underlying Mapp employee identity, exposed only when the company-context user email ends with `@mapp.com`.',
          expected: 'Empty for non-Mapp company users or when the LDAP mapper is not configured.',
        },
      ],
    },
  ];

  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="mb-2 text-2xl font-bold text-gray-900">Auth Debug</h1>
      <p className="mb-6 max-w-3xl text-sm text-gray-600">
        Developer-oriented view of the current session. Use <code>role</code>, <code>isSuperAdmin</code>, and
        <code> access</code> for app authorization. Treat company-context roles, workspaces, and
        <code> mappLdapGroups</code> as raw identity input unless your app explicitly maps them to permissions.
      </p>

      <div className="mb-6 grid gap-4 rounded-lg border border-blue-200 bg-blue-50 p-5 text-sm text-blue-950 md:grid-cols-3">
        <div>
          <h2 className="mb-1 font-semibold">Authorization Rule of Thumb</h2>
          <p>Use the session role first, then rely on superadmin status and access level for app permissions.</p>
        </div>
        <div>
          <h2 className="mb-1 font-semibold">Keycloak Migration Hint</h2>
          <p>
            <code>authSource=keycloak</code> confirms the session came through Keycloak.{' '}
            <code>identityProvider</code> shows whether it was brokered from Entra, company-context via Mapp Cloud, or resolved internally.
          </p>
        </div>
        <div>
          <h2 className="mb-1 font-semibold">Broker Hint Interpretation</h2>
          <p>
            <code>keycloakIdpHint</code> reflects the actual broker hint resolved for this session, not just the default app config.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {fieldSections.map((section) => (
          <section key={section.title} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
            <p className="mt-1 text-sm text-gray-600">{section.description}</p>

            {section.identity ? <IdentityCard identity={section.identity} /> : null}

            {section.groups ? (
              <div className="mt-5 space-y-4">
                {section.groups.map((group) => (
                  <SubSection key={group.title} title={group.title} variant={group.variant ?? 'lab'}>
                    {group.items.map((item) => (
                      <DebugFieldCard key={item.label} item={item} />
                    ))}
                  </SubSection>
                ))}
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {section.items?.map((item) => (
                  <DebugFieldCard key={item.label} item={item} />
                ))}
              </div>
            )}
          </section>
        ))}

        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Raw Session JSON</h2>
          <p className="mt-1 text-sm text-gray-600">
            Copy/paste view of the current session fields for debugging and issue reports.
          </p>
          <pre className="mt-5 overflow-x-auto whitespace-pre-wrap rounded-md border border-gray-100 bg-gray-50 p-4 text-sm text-gray-800">
            {JSON.stringify(debugData, null, 2)}
          </pre>
        </section>
      </div>
    </main>
  );
}

type DebugItem = {
  label: string;
  value: unknown;
  meaning: string;
  expected?: string;
};

type SubSectionVariant = 'lab' | 'cloud';

const SUB_SECTION_STYLE: Record<SubSectionVariant, { border: string; bg: string; chip: string; label: string }> = {
  lab: {
    border: 'border-gray-200',
    bg: 'bg-white',
    chip: 'bg-gray-100 text-gray-700 border border-gray-200',
    label: 'Lab App',
  },
  cloud: {
    border: 'border-indigo-200',
    bg: 'bg-indigo-50/40',
    chip: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
    label: 'Mapp Cloud',
  },
};

function SubSection({
  title,
  variant,
  children,
}: {
  title: string;
  variant: SubSectionVariant;
  children: React.ReactNode;
}) {
  const style = SUB_SECTION_STYLE[variant];
  return (
    <div className={`rounded-md border ${style.border} ${style.bg} p-4`}>
      <div className="mb-3 flex items-center gap-2">
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.chip}`}>
          {title}
        </span>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

type IdentityInfo = {
  email?: string | null;
  name?: string | null;
  identityProvider?: string | null;
  authSource?: string | null;
};

const IDP_LABELS: Record<string, { label: string; tone: string }> = {
  entra: { label: 'Mapp Entra ID', tone: 'bg-blue-600 text-white' },
  'mapp-cloud': { label: 'Company Login', tone: 'bg-violet-600 text-white' },
  internal: { label: 'Internal', tone: 'bg-gray-700 text-white' },
};

function IdentityCard({ identity }: { identity: IdentityInfo }) {
  const idp = identity.identityProvider ?? 'unknown';
  const known = IDP_LABELS[idp];
  return (
    <div className="mt-5 rounded-lg border-2 border-blue-200 bg-gradient-to-br from-blue-50 via-indigo-50 to-violet-50 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex-1">
          <div className="text-lg font-semibold text-gray-900">{identity.name ?? '(no name)'}</div>
          <div className="font-mono text-sm text-gray-700">{identity.email ?? '(no email)'}</div>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Signed in via</span>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              known ? known.tone : 'bg-gray-200 text-gray-800'
            }`}
          >
            {known ? known.label : idp}
          </span>
          {identity.authSource ? (
            <span className="text-xs text-gray-500">
              authSource: <code className="font-mono">{identity.authSource}</code>
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DebugFieldCard({ item }: { item: DebugItem }) {
  return (
    <div className="rounded-md border border-gray-100 bg-gray-50 p-4">
      <div
        className={`flex flex-col gap-2 ${
          item.label === 'workspaces' ? '' : 'md:flex-row md:items-start md:justify-between'
        }`}
      >
        <div>
          <h3 className="font-mono text-sm font-semibold text-gray-900">{item.label}</h3>
          <p className="mt-1 text-sm text-gray-700">{item.meaning}</p>
          {item.expected ? <p className="mt-1 text-xs text-gray-500">Expected: {item.expected}</p> : null}
        </div>

        <div className={item.label === 'workspaces' ? 'mt-3 w-full' : 'md:max-w-[50%]'}>
          <div className="rounded border border-gray-200 bg-white px-3 py-2 font-mono text-sm text-gray-900">
            {renderValue(item.value)}
          </div>
        </div>
      </div>
    </div>
  );
}

function renderValue(value: unknown) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }

    if (isWorkspaceEntries(value)) {
      return <WorkspaceTable workspaces={value} />;
    }

    if (value.every((entry) => typeof entry === 'string')) {
      return (
        <div className="flex flex-wrap gap-2">
          {value.map((entry) => (
            <span
              key={entry}
              className="rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-800"
            >
              {entry}
            </span>
          ))}
        </div>
      );
    }

    return <pre className="overflow-x-auto whitespace-pre-wrap text-xs">{JSON.stringify(value, null, 2)}</pre>;
  }

  if (value && typeof value === 'object') {
    return <pre className="overflow-x-auto whitespace-pre-wrap text-xs">{JSON.stringify(value, null, 2)}</pre>;
  }

  if (value === null || value === undefined) {
    return 'null';
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  return String(value);
}

function isWorkspaceEntries(value: unknown[]): value is WorkspaceDebugEntry[] {
  return value.every(
    (entry) =>
      entry &&
      typeof entry === 'object' &&
      'workspaceId' in entry &&
      'services' in entry
  );
}

function WorkspaceTable({ workspaces }: { workspaces: WorkspaceDebugEntry[] }) {
  const hiddenServicesHint =
    'Hidden from this table: UM (User Management), GUM (Global User Management), MYP (My Profile), GDPR_UDM (Data Privacy Compliance Manager), SELS (Select), BIZMO (Business Monitoring).';

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span>Visible product-facing services by workspace</span>
        <Tooltip
          content={hiddenServicesHint}
          position="bottom-right"
          allowWrap
        >
          <button
            type="button"
            className="inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:border-violet-200 hover:text-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            aria-label="Show hidden internal services"
            title={hiddenServicesHint}
          >
            <Icon type="info" size="xs" />
          </button>
        </Tooltip>
      </div>
      <table className="w-full border-collapse text-left text-xs">
        <colgroup>
          <col className="w-20" />
          <col />
        </colgroup>
        <thead>
          <tr className="border-b border-gray-200 text-[11px] uppercase tracking-wide text-gray-500">
            <th className="px-3 py-2 font-semibold">Workspace</th>
            <th className="px-3 py-2 font-semibold">Services</th>
          </tr>
        </thead>
        <tbody>
          {workspaces.map((workspace) => {
            const services = (workspace.services ?? []).filter(
              (service) => !HIDDEN_WORKSPACE_SERVICES.has(service)
            );

            return (
              <tr key={`${workspace.workspaceId}-${workspace.accountId ?? 'na'}`} className="border-b border-gray-100 align-top last:border-b-0">
                <td className="px-3 py-3 font-mono text-sm text-gray-900">{workspace.workspaceId ?? 'n/a'}</td>
                <td className="px-3 py-3">
                  {services.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {services.map((service) => (
                        <span
                          key={`${workspace.workspaceId}-${service}`}
                          className="rounded-2xl border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-medium leading-4 text-violet-900 break-words"
                        >
                          {SERVICE_LABELS[service] ?? service} ({service})
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-500">No visible services</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
