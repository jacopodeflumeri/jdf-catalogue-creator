/**
 * Navigation Component
 * 
 * Main header navigation bar component.
 * Displays logo, navigation items, search bar, and user menu.
 */

'use client';

import Link from 'next/link';
import Image from 'next/image';
import AppIdentity from '@/components/shared/layout/AppBranding';
import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
// Import S3ImageDisplay directly from component file to avoid loading the service
import S3ImageDisplay from '@/modules/s3_images/components/S3ImageDisplay';
import SearchBar from './SearchBar';
import AdminImpersonationBanner from './AdminImpersonationBanner';
import { useUserProfile } from '@/components/providers/UserProfileProvider';
import type { NavigationItem } from '../types';
import { getUserInitials, getUserDisplayName } from '../utils/navigation-helpers';
import { getParentActiveClasses, filterNavigationItems } from '../utils/navigation-filters';
import { getLogoHref, customerTopNav, LOGO_ALT_CONFIG, customerSidebar } from '@/modules/navigation/config/navigation-items';

import type { NavigationComponentProps } from '../types';
import Badge from '@/components/ui/Badge';

export default function NavigationComponent({
  className = '',
  isSimpleMode = false,
  customerAccount,
  navigationItems: navItems,
  isSuperAdmin,
  inPage = false,
  logoHref
}: NavigationComponentProps) {
  // Use optional session data - provide defaults if session fails
  let session = null;

  try {
    const sessionData = useSession();
    session = sessionData.data;
  } catch (_error) {
    // If useSession throws an error (not wrapped in SessionProvider), use defaults
    session = null;
  }

  const simpleNav = true;

  const pathname = usePathname();
  const { userProfile } = useUserProfile();
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // If simple mode is enabled, don't render the navigation
  if (isSimpleMode) {
    return null;
  }

  // Get user display information
  const userInitials = getUserInitials(userProfile, session?.user?.name, session?.user?.email);
  const userDisplayName = getUserDisplayName(userProfile, session?.user?.name, session?.user?.email);

  // Get logo href using the imported function
  if (!logoHref) {
    logoHref = getLogoHref(pathname);
  }

  // Use provided navigation items or empty array
  const items = navItems || [];

  // Filter navigation items based on conditions
  const filteredNavigationItems = filterNavigationItems(items, customerAccount, isSuperAdmin);


  return (
    <>
      <nav className={`${inPage ? 'relative' : 'fixed top-0 left-0 right-0 z-50'} bg-white/95 backdrop-blur-sm shadow-sm border-b border-gray-100 ${className}`}>
        <div className={`${inPage ? '' : 'max-w-[1440px] mx-auto'} h-full mx-auto px-4 sm:px-6 lg:px-8`}>
          <div className={`flex justify-between items-center ${inPage ? 'h-18' : 'h-16'} `} ref={navRef}>
            <div className="flex gap-6 justify-start">
              {/* Logo */}
              <div className="flex w-fit flex-shrink-0">
                <Link href={logoHref} className="text-xl font-bold text-gray-900">
                  {LOGO_ALT_CONFIG ? (
                    <Image
                      src={LOGO_ALT_CONFIG.src}
                      alt={LOGO_ALT_CONFIG.alt}
                      width={LOGO_ALT_CONFIG.width}
                      height={LOGO_ALT_CONFIG.height}
                      className={LOGO_ALT_CONFIG.className || "h-9 w-auto relative top-0.5"}
                      priority
                    />
                  ) : (
                    <span>Logo</span>
                  )}
                </Link>
                <Badge className="ml-2 mt-2" variant="primary" size="sm">
                  Labs
                </Badge>
              </div>

              <div className='flex items-start gap-4'>
                {customerAccount && !simpleNav && (<>
                  {filteredNavigationItems.map((item) => {
                    // Respect noChildren flag - if true, treat as standalone link even if children exist
                    const hasChildren = !item.noChildren && item.children && item.children.length > 0;
                    const isDropdown = hasChildren && !item.href;

                    return (
                      <div
                        key={item.name}
                        className="relative"
                        onMouseEnter={() => hasChildren ? setActiveDropdown(item.name) : null}
                        onMouseLeave={() => setActiveDropdown(null)}
                      >
                        {/* Parent Item */}
                        <Link
                          href={item.noLink ? "#" : (item.href || "#")}
                          className={`inline-flex items-center whitespace-nowrap py-2 px-2 rounded-xl font-medium text-sm transition-colors duration-300 ${getParentActiveClasses(item, pathname, activeDropdown)}`}
                          onClick={(e) => {
                            if (isDropdown) e.preventDefault();
                            setActiveDropdown(null);
                          }}
                        >
                          <span>{item.name}</span>
                          {hasChildren && (
                            <Icon
                              type="chevron-down"
                              size="sm"
                              className={`ml-1 transition-transform duration-200 ${activeDropdown === item.name ? 'rotate-180' : ''}`}
                            />
                          )}
                        </Link>

                        {/* Dropdown Menu */}
                        {activeDropdown === item.name && hasChildren && (
                          <div className="absolute top-full left-0 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-[60]">
                            <div className="py-1">
                              {item.children!.map((child: NavigationItem) => (
                                <Link
                                  key={child.href || child.name}
                                  href={child.href || '#'}
                                  className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-200 border-b border-gray-100 last:border-b-0"
                                  onClick={() => setActiveDropdown(null)}
                                >
                                  <div className="flex items-center">
                                    {child.icon && (
                                      <Icon
                                        type={child.icon as any}
                                        size="sm"
                                        className="mr-2"
                                      />
                                    )}
                                    <span className="font-medium">{child.name}</span>
                                  </div>
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
                )}
              </div>
            </div>

            <div className='flex min-w-0 gap-4 justify-end items-center'>

              <AppIdentity />

              {/* Admin Viewing Account Indicator */}
              {session?.user?.role === 'admin' && session?.user?.accountId ? (
                <>
                  {customerTopNav && !customerSidebar && (
                    <AdminImpersonationBanner />
                  )}
                </>
              ) : !simpleNav && (
                <>
                  {/* Search Bar */}
                  {customerAccount && (
                    <div className="w-96">
                      <SearchBar
                        placeholder="Search pages..."
                        className="w-full"
                        customerAccount={customerAccount}
                        resultsPosition="left"
                        resultsWidth="w-[500px]"
                      />
                    </div>
                  )}

                  {/* User Menu */}
                  <div className="flex items-right justify-end space-x-4">
                    {session ? (
                      <>
                        {!customerAccount ? (
                          <Link href={session.user.role === 'admin' ? "/admin" : "/account"}>
                            <Button variant="primary" size="sm">
                              {session.user.role === 'admin' ? "View Admin" : "View Account"}
                            </Button>
                          </Link>
                        ) : (
                          <>
                            {/* User Avatar and Info */}
                            <div className="relative flex items-center space-x-3 group">
                              {session.user.role === 'admin' ? (
                                <Link
                                  href="/admin/user"
                                  className="flex items-center space-x-2 hover:bg-gray-50 rounded-lg p-1 transition-colors"
                                >
                                  <div className="w-8 h-8 rounded-full overflow-hidden cursor-pointer" title={`${userDisplayName} (${session.user.role})`}>
                                    {userProfile?.image ? (
                                      <S3ImageDisplay
                                        s3Image={userProfile.image}
                                        alt={userDisplayName}
                                        width={32}
                                        height={32}
                                        className="w-8 h-8 rounded-full object-cover hover:opacity-90 transition-opacity"
                                        fallback={
                                          <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-bold hover:bg-primary-600 transition-colors">
                                            {userInitials}
                                          </div>
                                        }
                                      />
                                    ) : (
                                      <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-bold hover:bg-primary-600 transition-colors">
                                        {userInitials}
                                      </div>
                                    )}
                                  </div>
                                </Link>
                              ) : (
                                <div className="flex items-center space-x-2">
                                  <Link
                                    href="/account/settings"
                                  >
                                    <div className="w-8 h-8 rounded-full overflow-hidden" title="Logged In">
                                      <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center text-white text-sm font-bold">
                                        <Icon type="user" className="w-4 h-4 text-white" />
                                      </div>
                                    </div>
                                  </Link>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </>
                    ) : (
                      <Link href="/auth/signin">
                        <Button variant="primary" size="sm">
                          Sign In
                        </Button>
                      </Link>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </nav >
    </>
  );
}
