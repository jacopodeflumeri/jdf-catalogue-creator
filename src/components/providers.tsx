'use client';

import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';
import { UserProfileProvider } from '@/components/providers/UserProfileProvider';
import { ToastProvider } from '@/components/providers/ToastProvider';
import { ConfirmProvider } from '@/components/providers/ConfirmProvider';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <UserProfileProvider>
        <ToastProvider>
          <ConfirmProvider>
              {children}
          </ConfirmProvider>
        </ToastProvider>
      </UserProfileProvider>
    </SessionProvider>
  );
}
