"use client";

import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Icon, { type IconType } from "@/components/ui/Icon";
import PageHeader from "@/components/ui/PageHeader";

type SettingsSection = {
  label: string;
  icon: IconType;
  href: string;
  description: string;
  requiredLevel: "admin" | "viewer";
  /** Only shown for company-capable apps (Keycloak Company Login). */
  companyOnly?: boolean;
};

const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    label: "Mapp Team",
    icon: "rocket",
    href: "/admin/mapp-team",
    description: "Manage Mapp team members and access levels",
    requiredLevel: "admin",
  },
  {
    label: "Company Users",
    icon: "users",
    href: "/admin/company-users",
    description: "Company Login (Mapp Cloud) customers across all companies",
    requiredLevel: "viewer",
    companyOnly: true,
  },
  {
    label: "Audit Log",
    icon: "clock",
    href: "/admin/audit-log",
    description: "Who changed what, and when",
    requiredLevel: "viewer",
  },
];

interface AdminSettingsClientProps {
  accessLevel: string;
  isSuperAdmin: boolean;
  companyLoginEnabled?: boolean;
}

export default function AdminSettingsClient({ accessLevel, isSuperAdmin, companyLoginEnabled }: AdminSettingsClientProps) {
  const router = useRouter();

  const visibleSections = SETTINGS_SECTIONS.filter((section) => {
    if (section.companyOnly && !companyLoginEnabled) {
      return false;
    }
    if (section.requiredLevel === "admin") {
      return accessLevel === "admin" || isSuperAdmin;
    }
    return true;
  });

  return (
    <div className="px-8 py-6 space-y-8">
      <PageHeader
        title="Settings"
        description="Team access, company users, and the audit log"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {visibleSections.map((section) => (
          <Card
            key={section.href}
            hoverable
            onClick={() => router.push(section.href)}
            className="group h-full min-h-[112px]"
          >
            <div className="flex h-full items-center gap-4">
              <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center group-hover:bg-violet-100 transition-colors">
                <Icon type={section.icon} className="text-primary-600" size="md" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-[#1a1a1a]">{section.label}</p>
                <p className="text-sm text-[#1a1a1a]/45">{section.description}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
