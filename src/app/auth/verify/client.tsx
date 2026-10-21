'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Loading from '@/components/ui/Loading';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { confirmMagicLinkAction } from '@/modules/auth/client';

interface MagicLinkClientProps {
  token: string | null | undefined;
  redirectTo: string;
  validationResult: {
    success: boolean;
    error?: string;
    userSimple?: any;
    multipleAccounts?: boolean;
  } | null;
}

export default function MagicLinkClient({ 
  token, 
  redirectTo, 
  validationResult 
}: MagicLinkClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<'ready' | 'confirming' | 'signing-in' | 'success' | 'error'>('ready');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Handle confirmation button click
  const handleConfirmSignIn = () => {
    if (!token) {
      setStatus('error');
      setErrorMessage('Invalid or missing token');
      return;
    }

    setStatus('confirming');

    startTransition(async () => {
      try {
        // Confirm and consume the token (server action)
        const confirmResult = await confirmMagicLinkAction(token);

        if (!confirmResult.success) {
          setStatus('error');
          setErrorMessage(confirmResult.error || 'Confirmation failed');
          return;
        }

        if (!confirmResult.userSimple) {
          setStatus('error');
          setErrorMessage('Authentication data missing');
          return;
        }

        // Handle multiple accounts case
        if (confirmResult.multipleAccounts) {
          setStatus('signing-in');
          
          const signInResult = await signIn('magic-link', {
            userData: JSON.stringify(confirmResult.userSimple),
            callbackUrl: `/auth/select-account?callbackUrl=${encodeURIComponent(redirectTo)}`,
            redirect: false,
          });

          if (signInResult?.error) {
            setStatus('error');
            setErrorMessage(signInResult.error);
          } else {
            setStatus('success');
            setTimeout(() => {
              window.location.href = `/auth/select-account?callbackUrl=${encodeURIComponent(redirectTo)}`;
            }, 500);
          }
          return;
        }

        // Single account - proceed with sign in
        setStatus('signing-in');

        const signInResult = await signIn('magic-link', {
          userData: JSON.stringify(confirmResult.userSimple),
          callbackUrl: redirectTo,
          redirect: false,
        });

        if (signInResult?.error) {
          setStatus('error');
          setErrorMessage(signInResult.error);
        } else {
          setStatus('success');
          setTimeout(() => {
            window.location.href = redirectTo;
          }, 500);
        }
      } catch (_error) {
        setStatus('error');
        setErrorMessage('Authentication failed');
      }
    });
  };

  // Check validation result on mount
  if (!token) {
    return (
      <div className="flex-1 bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
              <Icon type="x" className="text-red-600" size="lg" />
            </div>
            <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
              Invalid Link
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              The magic link is invalid or missing.
            </p>
          </div>
        </div>
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <Card>
            <div className="text-center">
              <Button
                variant="primary"
                className="w-full"
                onClick={() => router.push('/auth/signin')}
              >
                Back to Sign In
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (!validationResult || !validationResult.success) {
    return (
      <div className="flex-1 bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
              <Icon type="x" className="text-red-600" size="lg" />
            </div>
            <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
              Verification Failed
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              {validationResult?.error || 'The magic link is invalid or has expired.'}
            </p>
          </div>
        </div>
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <Card>
            <div className="text-center">
              <Button
                variant="primary"
                className="w-full"
                onClick={() => router.push('/auth/signin')}
              >
                Back to Sign In
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Show confirmation page (token validated but not consumed yet)
  if (status === 'ready') {
    return (
      <div className="flex-1 bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-primary-100">
              <Icon type="mail" className="text-primary-600" size="xl" />
            </div>
            <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
              Welcome Back!
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Click the button below to sign in to your account.
            </p>
          </div>
        </div>
        
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <Card>
            <div className="text-center space-y-4">
              <p className="text-sm text-gray-700">
                You&apos;re about to sign in as:
              </p>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-900">
                  {validationResult.userSimple?.email || 'Your Account'}
                </p>
              </div>
              <Button
                variant="primary"
                className="w-full"
                onClick={handleConfirmSignIn}
                disabled={isPending}
              >
                {isPending ? 'Signing In...' : 'Sign In to Your Account'}
              </Button>
              <p className="text-xs text-gray-500">
                This link can only be used once and will expire after use.
              </p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (status === 'confirming' || status === 'signing-in') {
    return (
      <div className="flex-1 bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center py-8">
            <Loading size="lg" text="Verifying your access..." />
          </div>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="flex-1 bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-primary-100">
              <Icon type="check" className="text-primary-600" size="lg" />
            </div>
            <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
              Successfully signed in!
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              You&apos;re being redirected to your dashboard...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  return (
    <div className="flex-1 bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
            <Icon type="x" className="text-red-600" size="lg" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
            Verification Failed
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {errorMessage}
          </p>
        </div>
      </div>
      
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card>
          <div className="text-center">
            <div className="space-y-4">
              <div className="space-y-2">
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => router.push('/auth/signin')}
                >
                  Back to Sign In
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
