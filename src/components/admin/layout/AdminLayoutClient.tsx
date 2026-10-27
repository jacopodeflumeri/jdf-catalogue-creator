"use client";

import { useState } from "react";
import MobileAppHeader from "@/components/shared/layout/MobileAppHeader";
import { useSession } from "next-auth/react";
import { isAdminAccessSession } from "@/modules/auth/client";
import AdminErrorBoundary from "@/modules/auth/components/AdminErrorBoundary";
import { AdminErrorProvider } from "@/modules/auth/components/AdminErrorProvider";
import { UserProfileProvider } from "@/components/providers/UserProfileProvider";
import {
  Sidebar,
  createNavigationItems,
  ADMIN_NAVIGATION_ADMIN_ITEMS,
  ADMIN_UTILITY_NAVIGATION_ITEMS,
} from "@/modules/navigation";
import type { MappTeamResponse } from "@/types";

interface AdminLayoutProps {
  children: React.ReactNode;
  userProfile: MappTeamResponse | null;
  catalogNavigation: Array<{ slug: string; name: string }>;
}

const AdminLayoutClientNew: React.FC<AdminLayoutProps> = ({
  children,
  userProfile,
  catalogNavigation,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { data: session } = useSession();

  // Auth is enforced server-side in app/admin/layout.tsx (requireAdmin). The
  // client session only drives chrome (e.g. which admin-access nav items show);
  // it must NEVER gate whether {children} render, or nothing server-renders —
  // SSR session status is always "loading". See docs/template/ROUTING.md.
  const isAdminAccess = session ? isAdminAccessSession(session) : false;

  // Create navigation items using unified function
  const navigationItems = createNavigationItems("admin", undefined, catalogNavigation);

  return (
    <AdminErrorProvider>
      <UserProfileProvider initialProfile={userProfile}>
        <AdminErrorBoundary>
          <div className="h-screen overflow-hidden app-background">
            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
              <div
                className="fixed inset-0 z-50 sm:hidden"
                onClick={() => setSidebarOpen(false)}
              >
                <div className="absolute inset-0 bg-[rgba(26,26,26,0.18)] backdrop-blur-sm"></div>
              </div>
            )}

            {/* Desktop Sidebar (fixed position, overlays content for glass effect) */}
            <Sidebar
              variant="desktop"
              navigationItems={navigationItems}
              utilityNavigationItems={ADMIN_UTILITY_NAVIGATION_ITEMS}
              adminAccessItems={ADMIN_NAVIGATION_ADMIN_ITEMS}
              isAdminAccess={isAdminAccess}
              userType="admin"
              dashboardRoute="/admin"
              onCollapsedChange={setSidebarCollapsed}
            />

            {/* Mobile Sidebar */}
            <Sidebar
              variant="mobile"
              isOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              navigationItems={navigationItems}
              utilityNavigationItems={ADMIN_UTILITY_NAVIGATION_ITEMS}
              adminAccessItems={ADMIN_NAVIGATION_ADMIN_ITEMS}
              isAdminAccess={isAdminAccess}
              userType="admin"
              dashboardRoute="/admin"
            />

            {/* Main content - left margin offsets for fixed sidebar */}
            <div
              className={`flex flex-col h-full transition-all duration-300 ${sidebarCollapsed ? "sm:ml-16" : "sm:ml-[260px]"}`}
            >
              <MobileAppHeader onOpen={() => setSidebarOpen(true)} />
              <main className="flex-1 overflow-y-auto p-6 lg:p-8">
                <div className="max-w-[1600px] mx-auto">{children}</div>
              </main>
            </div>
          </div>
        </AdminErrorBoundary>
      </UserProfileProvider>
    </AdminErrorProvider>
  );
};

export default AdminLayoutClientNew;
