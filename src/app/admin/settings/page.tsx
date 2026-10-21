import { Metadata } from 'next'
import { requireAdmin } from '@/modules/auth/server'
import { config } from '@/config'
import AdminSettingsClient from './client'
import { pageTitle } from '@/lib/utils/metadata'

export const metadata: Metadata = {
  title: pageTitle('Settings'),
  description: 'Team access, company users, and the audit log',
}

export default async function SettingsPage() {
  const session = await requireAdmin({});
  const accessLevel = (session?.user as any)?.access || "viewer";
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin === true;
  // The Company Users card shows for apps with the Company Login capability on
  // (the default). Mapp-internal-only apps set COMPANY_LOGIN_ENABLED=false.
  const companyLoginEnabled = config.companyLogin.enabled;

  return (
    <AdminSettingsClient
      accessLevel={accessLevel}
      isSuperAdmin={isSuperAdmin}
      companyLoginEnabled={companyLoginEnabled}
    />
  )
}
