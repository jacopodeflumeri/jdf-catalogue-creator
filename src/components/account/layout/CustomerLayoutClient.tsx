"use client";

import { useState } from "react";
import MobileAppHeader from "@/components/shared/layout/MobileAppHeader";
import { AuthErrorProvider } from "@/modules/auth/components/AuthErrorProvider";
import { CustomerAccountProvider } from "@/components/providers/CustomerAccountProvider";
import { useSearchParams } from "next/navigation";
import {
  NavigationComponent,
  Sidebar,
  createNavigationItems,
  filterSidebarItems,
} from "@/modules/navigation";
import type { Session } from "next-auth";
import type { CustomerAccountData } from "@/types";
import {
  customerSidebar,
  customerTopNav,
  customerTopNavFixed,
} from "@/modules/navigation/config/navigation-items";
import Footer from "@/components/shared/layout/Footer";

interface CustomerLayoutProps {
  children: React.ReactNode;
  customerAccount: CustomerAccountData | null;
  /**
   * The SERVER session (from `requireCustomer` in app/account/layout.tsx).
   * Anything session-dependent in this shell must be decided from this prop,
   * never from `useSession()` — see the comment in the component body.
   */
  session: Session;
}

const CustomerLayoutClient: React.FC<CustomerLayoutProps> = ({
  children,
  customerAccount,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Auth is enforced server-side in app/account/layout.tsx (requireCustomer),
  // which passes the resolved session in as a prop. The client session must
  // NEVER gate whether {children} render: SSR session status is always
  // "loading", so waiting on useSession() made every customer page's
  // server-rendered HTML a full-screen spinner until the browser had fetched
  // /api/auth/session — an extra round trip before anything painted. Chrome
  // that depends on the session reads the `session` prop instead.

  // The inner NavigationComponent, not the default `NavigationWrapper` export:
  // the wrapper renders nothing until mounted, so the top bar popped in after
  // hydration and shoved every customer page down. The wrapper's only other
  // job, `?simple=true` (hide the nav), is replicated here.
  const searchParams = useSearchParams();
  const isSimpleMode = searchParams.get("simple") === "true";

  // Create unified navigation items
  const navigationItems = createNavigationItems("customer", customerAccount);

  // If customer wants top nav, use that layout
  if (customerTopNav && !customerSidebar) {
    return (
      <>
        <NavigationComponent
          isSimpleMode={isSimpleMode}
          customerAccount={customerAccount}
          navigationItems={navigationItems}
        />
        <div className="min-h-screen pt-16 flex flex-col">
          <main className="flex-1 flex flex-col overflow-y-auto focus:outline-none">
            <CustomerAccountProvider customerAccount={customerAccount}>
              {children}
            </CustomerAccountProvider>
          </main>
        </div>
        <Footer />
      </>
    );
  }

  // Filter navigation items for sidebar
  const filteredNavigationItems = filterSidebarItems(
    navigationItems,
    customerAccount,
    false,
  );

  return (
    <AuthErrorProvider>
      <div className="h-screen overflow-hidden app-background">
        {customerSidebar && (
          <>
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
              navigationItems={filteredNavigationItems}
              userType="customer"
              dashboardRoute="/account"
              onCollapsedChange={setSidebarCollapsed}
            />

            {/* Mobile Sidebar */}
            <Sidebar
              variant="mobile"
              isOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              navigationItems={filteredNavigationItems}
              userType="customer"
              dashboardRoute="/account"
            />
          </>
        )}

        {/* Main content - left margin offsets for fixed sidebar */}
        <div
          className={`flex flex-col h-full transition-all duration-300 ${customerSidebar ? (sidebarCollapsed ? "sm:ml-16" : "sm:ml-[260px]") : ""}`}
        >
          {customerSidebar && <MobileAppHeader onOpen={() => setSidebarOpen(true)} />}
          {/* In-page top nav */}
          {customerTopNav && customerTopNavFixed && (
            <NavigationComponent
              isSimpleMode={isSimpleMode}
              customerAccount={customerAccount}
              navigationItems={navigationItems}
              inPage={true}
            />
          )}
          {/*
            flex-col + a flex-1 content wrapper keeps the footer at the bottom
            of the viewport however short the page (or its loading skeleton)
            is, so it doesn't jump as content arrives.
          */}
          <main className="flex-1 flex flex-col overflow-y-auto focus:outline-none">
            {customerTopNav && !customerTopNavFixed && (
              <NavigationComponent
                isSimpleMode={isSimpleMode}
                customerAccount={customerAccount}
                navigationItems={navigationItems}
                inPage={true}
              />
            )}
            <div className="flex-1 flex flex-col">
              <CustomerAccountProvider customerAccount={customerAccount}>
                {children}
              </CustomerAccountProvider>
            </div>
            <Footer />
          </main>
        </div>
      </div>
    </AuthErrorProvider>
  );
};

export default CustomerLayoutClient;
