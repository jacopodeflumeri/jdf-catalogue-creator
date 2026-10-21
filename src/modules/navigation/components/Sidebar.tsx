"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { IconType } from "@/components/ui/Icon";
import UserProfileCard from "@/components/shared/user/UserProfileCard";
import type { NavigationItem } from "../types";
import { isNavItemActive } from "../utils/navigation-filters";
import { LOGO_ALT_CONFIG } from "../config/navigation-items";
import AdminImpersonationBanner from "./AdminImpersonationBanner";
import EnvironmentLabsPill from "./EnvironmentLabsPill";
import { config } from "@/config";
import AppIdentity from "@/components/shared/layout/AppBranding";

interface SidebarProps {
  variant: "desktop" | "mobile";
  isOpen?: boolean;
  onClose?: () => void;
  navigationItems: NavigationItem[];
  /** Pinned to the bottom of the sidebar, below a divider (e.g. Settings). */
  utilityNavigationItems?: NavigationItem[];
  adminAccessItems?: NavigationItem[];
  isAdminAccess?: boolean;
  userType: "admin" | "customer";
  dashboardRoute: string;
  onCollapsedChange?: (collapsed: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  variant,
  isOpen = true,
  onClose,
  navigationItems,
  utilityNavigationItems = [],
  adminAccessItems = [],
  isAdminAccess = false,
  userType,
  dashboardRoute,
  onCollapsedChange,
}) => {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleCollapse = (collapsed: boolean) => {
    setIsCollapsed(collapsed);
    onCollapsedChange?.(collapsed);
  };

  const getActiveClasses = (isActive: boolean) =>
    isActive
      ? "ds-floating-nav-item-active text-primary font-semibold"
      : "ds-floating-nav-item";

  const getSubActiveClasses = (isSubActive: boolean) =>
    isSubActive
      ? "ds-floating-nav-item-active text-primary font-semibold"
      : "ds-floating-nav-item";

  const handleLinkClick = variant === "mobile" ? onClose : undefined;

  if (variant === "mobile") {
    return (
      <div
        className={`fixed inset-y-0 left-0 z-[60] w-[260px] glass-sidebar border-r border-white/30 transform transition-transform duration-300 ease-in-out ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex flex-col h-full w-full">
          {/* Logo */}
          <div className="flex items-center pt-2 h-18 px-6 flex-shrink-0">
            <Link href={dashboardRoute} className="flex items-center space-x-3">
              <img
                src={LOGO_ALT_CONFIG.src}
                alt={LOGO_ALT_CONFIG.alt}
                className="h-7 w-auto"
              />
            </Link>
            <EnvironmentLabsPill
              mode="pill"
              environment={config.app.environment}
              className="ml-2 mt-0.5"
            />
          </div>

          <Link href={dashboardRoute} onClick={handleLinkClick} className="mx-6 mt-2 min-w-0">
            <AppIdentity />
          </Link>

          {/* Navigation */}
          <nav className="flex-1 px-6 py-6 space-y-3 overflow-y-auto">
            {navigationItems.map((item) => {
              const isActive = isNavItemActive(item.href, pathname);
              const hasSubItems = item.children && item.children.length > 0;

              return (
                <div key={item.href}>
                  <Link
                    href={item.href || "#"}
                    className={`flex items-center space-x-3 px-4 h-12 rounded-xl text-sm font-medium transition-all duration-300 ${getActiveClasses(isActive)}`}
                    onClick={handleLinkClick}
                  >
                    {item.icon && (
                      <Icon
                        type={item.icon as IconType}
                        size="lg"
                        className="flex-shrink-0"
                      />
                    )}
                    <span>{item.name}</span>
                  </Link>

                  {hasSubItems && (
                    <div className="ml-4 mt-1 space-y-1">
                      {item.children!.map((subItem) => {
                        if (!subItem.href) return null;
                        const isSubActive = isNavItemActive(subItem.href, pathname);
                        return (
                          <Link
                            key={subItem.href}
                            href={subItem.href}
                            className={`flex items-center px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${getSubActiveClasses(isSubActive)}`}
                            onClick={handleLinkClick}
                          >
                            <Icon
                              type="chevron-right"
                              size="xs"
                              className="mr-3 text-[#1a1a1a]/45"
                            />
                            <span>{subItem.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Admin Section */}
          {isAdminAccess && adminAccessItems.length > 0 && (
            <div className="border-t border-white/55 flex-shrink-0">
              <nav className="px-6 py-4 space-y-3">
                {adminAccessItems.map((item) => {
                  if (!item.href) return null;
                  const isActive = isNavItemActive(item.href, pathname);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center space-x-3 px-4 h-12 rounded-xl text-sm font-medium transition-all duration-300 ${getActiveClasses(isActive)}`}
                      onClick={handleLinkClick}
                    >
                      {item.icon && (
                        <Icon
                          type={item.icon as IconType}
                          size="md"
                          className="mr-2 flex-shrink-0"
                        />
                      )}
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          )}

          {/* Utility items (Settings) - pinned to the bottom */}
          {utilityNavigationItems.length > 0 && (
            <div className="border-t border-white/55 flex-shrink-0">
              <nav className="px-6 py-4 space-y-3">
                {utilityNavigationItems.map((item) => {
                  if (!item.href) return null;
                  const isActive = isNavItemActive(item.href, pathname);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center space-x-3 px-4 h-12 rounded-xl text-sm font-medium transition-all duration-300 ${getActiveClasses(isActive)}`}
                      onClick={handleLinkClick}
                    >
                      {item.icon && (
                        <Icon
                          type={item.icon as IconType}
                          size="lg"
                          className="flex-shrink-0"
                        />
                      )}
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          )}

          <AdminImpersonationBanner type="sidebar" variant="mobile" />

          <UserProfileCard
            userType={userType}
            variant="mobile"
            onMobileClick={handleLinkClick}
          />
        </div>
      </div>
    );
  }

  // Desktop variant with collapsible state
  return (
    <div
      className={`hidden sm:flex fixed inset-y-0 left-0 z-50 ${isCollapsed ? "w-16" : "w-[260px]"} glass-sidebar transition-all duration-300`}
    >
      <div className="flex flex-col h-full w-full">
        {/* Logo */}
        <div
          className={`flex items-center pt-2 h-18 flex-shrink-0 ${isCollapsed ? "justify-center px-2" : "px-6"}`}
        >
          {isCollapsed ? (
            <div className="relative inline-flex items-start justify-center">
              <Link
                href={dashboardRoute}
                className="flex items-center justify-center"
              >
                <AppIdentity compact />
              </Link>
              <EnvironmentLabsPill
                mode="dot"
                environment={config.app.environment}
                className="absolute -top-1 -right-1"
              />
            </div>
          ) : (
            <>
              <Link
                href={dashboardRoute}
                className="flex items-center space-x-3"
              >
                <img
                  src={LOGO_ALT_CONFIG.src}
                  alt={LOGO_ALT_CONFIG.alt}
                  className="h-7 w-auto"
                />
              </Link>
              <EnvironmentLabsPill
                mode="pill"
                environment={config.app.environment}
                className="ml-2 mt-0.5"
              />
            </>
          )}
        </div>

        {!isCollapsed && (
          <Link href={dashboardRoute} className="mx-6 mt-2 min-w-0">
            <AppIdentity />
          </Link>
        )}

        {/* Navigation */}
        <nav
          className={`flex-1 py-6 space-y-3 overflow-y-auto ${isCollapsed ? "px-2" : "px-6"}`}
        >
          {isCollapsed ? (
            // Collapsed: icons only with tooltips
            <div className="space-y-3 flex flex-col items-center">
              {navigationItems.map((item, index) => {
                if (!item.href) {
                  if (item.children && item.children.length > 0) {
                    return (
                      <React.Fragment key={item.name || index}>
                        {item.children.map((child) => {
                          if (!child.href || !child.icon) return null;
                          const isActive = isNavItemActive(child.href, pathname);
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              title={child.name}
                              className={`p-3 rounded-xl transition-all duration-300 ${getActiveClasses(isActive)}`}
                            >
                              <Icon type={child.icon as IconType} size="lg" />
                            </Link>
                          );
                        })}
                      </React.Fragment>
                    );
                  }
                  return null;
                }

                if (!item.icon) return null;
                const isActive = isNavItemActive(item.href, pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.name}
                    className={`p-3 rounded-xl transition-all duration-300 ${getActiveClasses(isActive)}`}
                  >
                    <Icon type={item.icon as IconType} size="lg" />
                  </Link>
                );
              })}
            </div>
          ) : (
            // Expanded: icons + text labels
            <>
              {navigationItems.map((item) => {
                const isActive = isNavItemActive(item.href, pathname);
                const hasSubItems = item.children && item.children.length > 0;

                return (
                  <div key={item.href}>
                    <Link
                      href={item.href || "#"}
                      className={`flex items-center space-x-3 px-4 h-12 rounded-xl text-sm font-medium transition-all duration-300 ${getActiveClasses(isActive)}`}
                    >
                      {item.icon && (
                        <Icon
                          type={item.icon as IconType}
                          size="lg"
                          className="flex-shrink-0"
                        />
                      )}
                      <span>{item.name}</span>
                    </Link>

                    {hasSubItems && (
                      <div className="ml-4 mt-1 space-y-1">
                        {item.children!.map((subItem) => {
                          if (!subItem.href) return null;
                          const isSubActive = isNavItemActive(subItem.href, pathname);
                          return (
                            <Link
                              key={subItem.href}
                              href={subItem.href}
                              className={`flex items-center px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${getSubActiveClasses(isSubActive)}`}
                            >
                              <Icon
                                type="chevron-right"
                                size="xs"
                                className="mr-3 text-[#1a1a1a]/45"
                              />
                              <span>{subItem.name}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </nav>

        {/* Admin Section */}
        {isAdminAccess && !isCollapsed && adminAccessItems.length > 0 && (
          <div className="border-t border-white/55 flex-shrink-0">
            <nav className="px-6 py-4 space-y-3">
              {adminAccessItems.map((item) => {
                if (!item.href) return null;
                const isActive = isNavItemActive(item.href, pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center space-x-3 px-4 h-12 rounded-xl text-sm font-medium transition-all duration-300 ${getActiveClasses(isActive)}`}
                  >
                    {item.icon && (
                      <Icon
                        type={item.icon as IconType}
                        size="md"
                        className="mr-2 flex-shrink-0"
                      />
                    )}
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

        {/* Admin Section - Collapsed */}
        {isAdminAccess && isCollapsed && adminAccessItems.length > 0 && (
          <div className="border-t border-white/55 flex-shrink-0">
            <nav className="px-2 py-4 space-y-3 flex flex-col items-center">
              {adminAccessItems.map((item) => {
                if (!item.href || !item.icon) return null;
                const isActive = isNavItemActive(item.href, pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.name}
                    className={`p-3 rounded-xl transition-all duration-300 ${getActiveClasses(isActive)}`}
                  >
                    <Icon type={item.icon as IconType} size="lg" />
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

        {/* Utility items (Settings) - Expanded, pinned to the bottom */}
        {utilityNavigationItems.length > 0 && !isCollapsed && (
          <div className="border-t border-white/55 flex-shrink-0">
            <nav className="px-6 py-4 space-y-3">
              {utilityNavigationItems.map((item) => {
                if (!item.href) return null;
                const isActive = isNavItemActive(item.href, pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center space-x-3 px-4 h-12 rounded-xl text-sm font-medium transition-all duration-300 ${getActiveClasses(isActive)}`}
                  >
                    {item.icon && (
                      <Icon
                        type={item.icon as IconType}
                        size="lg"
                        className="flex-shrink-0"
                      />
                    )}
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

        {/* Utility items (Settings) - Collapsed */}
        {utilityNavigationItems.length > 0 && isCollapsed && (
          <div className="border-t border-white/55 flex-shrink-0">
            <nav className="px-2 py-4 space-y-3 flex flex-col items-center">
              {utilityNavigationItems.map((item) => {
                if (!item.href || !item.icon) return null;
                const isActive = isNavItemActive(item.href, pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.name}
                    className={`p-3 rounded-xl transition-all duration-300 ${getActiveClasses(isActive)}`}
                  >
                    <Icon type={item.icon as IconType} size="lg" />
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

        <AdminImpersonationBanner
          type="sidebar"
          variant={isCollapsed ? "collapsed" : "desktop"}
        />

        {/* User Profile Card - only when expanded */}
        {!isCollapsed && (
          <UserProfileCard userType={userType} variant="desktop" />
        )}

        {/* Collapse Toggle */}
        <div
          className={`flex-shrink-0 border-t border-white/55 ${isCollapsed ? "px-2" : "px-6"} py-3`}
        >
          <button
            onClick={() => handleCollapse(!isCollapsed)}
            className="flex items-center justify-center w-full p-2 rounded-xl ds-floating-nav-item transition-all duration-300 focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(141,119,247,0.2)]"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Icon
              type="chevron-right"
              size="md"
              className={`transition-transform duration-300 ${isCollapsed ? "" : "rotate-180"}`}
            />
            {!isCollapsed && (
              <span className="ml-2 text-sm font-medium">Collapse</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
