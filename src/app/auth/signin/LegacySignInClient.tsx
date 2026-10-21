'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import FormInput from '@/components/ui/form/FormInput';
import Card from '@/components/ui/Card';
import Loading from '@/components/ui/Loading';
import Icon from '@/components/ui/Icon';
import { config } from '@/config';
import logger from '@/lib/utils/logger';

// Wrapper component that handles search params
function SignInFormWrapper() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/account';
  const errorParam = searchParams.get('error');
  
  return <SignInForm callbackUrl={callbackUrl} errorParam={errorParam} />;
}

interface SignInFormProps {
  callbackUrl: string;
  errorParam: string | null;
}

function SignInForm({ callbackUrl, errorParam }: SignInFormProps) {
  
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [_message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const router = useRouter();

  const handleMagicLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    // Check if email contains @mapp.com
    if (email.toLowerCase().includes('@mapp.com')) {
      setLoading(false);
      router.push('/auth/admin?error=SSORrequired');
      return;
    }

    try {
      const response = await fetch('/api/auth/send-magic-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          callbackUrl,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSentEmail(email);
        setShowSuccess(true);
        setMessage('Check your email for the magic link to sign in.');
      } else {
        setError(data.error || 'Failed to send magic link. Please try again.');
        setShowSuccess(false);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      setShowSuccess(false);
      logger.error('Sign in error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToSignIn = () => {
    setShowSuccess(false);
    setMessage('');
    setError('');
    setSentEmail('');
    setEmail('');
  };

  return (
    <div className="flex-1 bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-primary-100">
            <Icon type={showSuccess ? "mail" : "lock"} className="text-primary-600" size="lg" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
            {showSuccess ? "Check your email" : "Customer Sign In"}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {showSuccess ? `We've sent a sign-in link to ${sentEmail ? sentEmail : 'your email address'}` : "Access your Dashboard"}
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        {showSuccess ? (
          // Success State - Enhanced from verify page
          <Card>
            <div className="text-center">
              
              <div className="space-y-4">
                <div className="text-sm text-gray-500">
                  <p>Check your email inbox and click the magic link to be automatically signed in.</p>
                </div>
                
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-500 mb-4">
                    Don&apos;t see the email? Check your spam folder or try signing in again.
                  </p>
                  
                  <div className="space-y-2">
                    <Button 
                      variant="primary" 
                      className="w-full"
                      onClick={handleBackToSignIn}
                    >
                      Back to Sign In
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ) : (
          // Sign In Form State
          <div className="space-y-6">
            {/* Error Messages */}
            {(error || errorParam) && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-sm text-red-700">
                  {error || 
                    (errorParam === 'AdminRequired' && 'Admin access required') ||
                    (errorParam === 'CustomerRequired' && 'Customer access required') ||
                    'An error occurred during sign in'}
                </p>
              </div>
            )}

            {/* Customer Magic Link Form */}
            <Card>
              <form onSubmit={handleMagicLinkSubmit} className="space-y-4">
                  <FormInput
                  id="email"
                  name="email"
                  type="email"
                  label="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  />
                <Button
                  type="submit"
                  loading={loading}
                  disabled={!email || loading}
                  className="w-full"
                >
                  Send Magic Link
                </Button>
              </form>
            </Card>

            {/* Admin Sign In Link */}
            <div className="text-center">
              <Link
                href="/auth/admin"
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <Icon type="shield" className="mr-2" size="sm" />
                Admin Login
              </Link>
            </div>
          </div>
        )}

        {/* Footer */}
        {showSuccess ? (
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              The magic link will expire in {config.magicLink.expirySeconds / 60} minutes for security.
            </p>
          </div>
        ) : (
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-600">
              Need help?{' '}
              <Link href="/contact" className="font-medium text-primary-600 hover:text-primary-500">
                Contact Support
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LegacySignInClient() {
  return (
    <Suspense fallback={<Loading />}>
      <SignInFormWrapper />
    </Suspense>
  );
}
