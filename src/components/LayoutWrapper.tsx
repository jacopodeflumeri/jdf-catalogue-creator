'use client';

import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import Footer from '@/components/shared/layout/Footer';

const Navigation = dynamic(
  () => import('@/modules/navigation/components/NavigationWrapper'),
  { ssr: false }
);

interface LayoutWrapperProps {
  children: React.ReactNode;
}

const LayoutWrapper: React.FC<LayoutWrapperProps> = ({ children }) => {
  const pathname = usePathname();
  const { data: _session } = useSession();

  // Token management is now handled server-side by TokenManager
  const isAdminRoute = pathname.startsWith('/admin');
  const isCustomerRoute = pathname.startsWith('/account');
  const isAuthRoute = pathname.startsWith('/auth');

  // Admin routes use their own server-side layout at /app/admin/layout.tsx
  // Customer routes use their own server-side layout at /app/account/layout.tsx
  // Auth routes should also stay minimal so login/session flows do not pull
  // in the public navigation shell and its optional search dependencies.
  if (isAdminRoute || isCustomerRoute || isAuthRoute) {
    // For admin routes, just return children without Navigation
    // Middleware handles all token management transparently
    return <>{children}</>;
  }

  // For public routes, show Navigation
  return (
    <>
      <Suspense fallback={null}>
        <Navigation />
      </Suspense>
      <div className="min-h-screen pt-16 flex flex-col">
        {children}
      </div>
      <Footer />
    </>
  );
};

export default LayoutWrapper;
