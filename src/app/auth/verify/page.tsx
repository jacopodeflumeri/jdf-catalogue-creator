import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { config } from '@/config';
import { validateMagicLinkToken } from '@/modules/auth/server';
import MagicLinkClient from '@/app/auth/verify/client';

interface MagicLinkPageProps {
  searchParams: Promise<{
    token?: string;
    redirect?: string;
  }>;
}

export default async function MagicLinkPage({ searchParams }: MagicLinkPageProps) {
  // Magic-link is an optional capability; when off there are no links to verify.
  if (!config.magicLink.enabled) {
    notFound();
  }

  const params = await searchParams;
  const token = params.token;
  const redirectTo = params.redirect || '/account';

  // Validate token server-side WITHOUT consuming it
  // This prevents email prefetching from marking the token as used
  let validationResult = null;
  
  if (token) {
    validationResult = await validateMagicLinkToken(token);
  }

  // Pass validation result to client component
  // Client will show confirmation button and only consume token on user click
  return (
    <Suspense>
      <MagicLinkClient 
        token={token}
        redirectTo={redirectTo}
        validationResult={validationResult}
      />
    </Suspense>
  );
}
