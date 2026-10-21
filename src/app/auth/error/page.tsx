'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Loading from '@/components/ui/Loading';
import Icon from '@/components/ui/Icon';

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const getErrorMessage = (error: string | null) => {
    switch (error) {
      case 'Configuration':
        return {
          title: 'Configuration Error',
          description: 'There is a problem with the server configuration. Please contact support.',
          icon: 'warning' as const,
          iconColor: 'text-red-600',
          bgColor: 'bg-red-100',
        };
      case 'AccessDenied':
        return {
          title: 'Access Denied',
          description: 'You do not have permission to access this resource.',
          icon: 'shield' as const,
          iconColor: 'text-red-600',
          bgColor: 'bg-red-100',
        };
      case 'AccessSuspended':
        return {
          title: 'Account Suspended',
          description: 'Your admin access has been temporarily suspended. Please contact support for assistance.',
          icon: 'warning' as const,
          iconColor: 'text-orange-600',
          bgColor: 'bg-orange-100',
          showSignOut: true,
        };
      case 'AccessDeniedPermanent':
        return {
          title: 'Access Denied',
          description: 'You do not have permission to access the admin panel. If you believe this is an error, please contact support.',
          icon: 'x' as const,
          iconColor: 'text-red-600',
          bgColor: 'bg-red-100',
          showSignOut: true,
        };
      case 'InsufficientPermissions':
        return {
          title: 'Insufficient Permissions',
          description: 'Your current access level does not permit this action. Please contact a system administrator if you need elevated permissions.',
          icon: 'shield' as const,
          iconColor: 'text-orange-600',
          bgColor: 'bg-orange-100',
        };
      case 'Verification':
        return {
          title: 'Verification Failed',
          description: 'The verification link has expired or is invalid. Please try signing in again.',
          icon: 'warning' as const,
          iconColor: 'text-red-600',
          bgColor: 'bg-red-100',
        };
      case 'EmailCreateAccount':
        return {
          title: 'Email Not Found',
          description: 'The email address is not registered in our system. Please contact support.',
          icon: 'warning' as const,
          iconColor: 'text-red-600',
          bgColor: 'bg-red-100',
        };
      case 'AdminRequired':
        return {
          title: 'Admin Access Required',
          description: 'You need administrator privileges to access this area.',
          icon: 'shield' as const,
          iconColor: 'text-red-600',
          bgColor: 'bg-red-100',
        };
      case 'CustomerRequired':
        return {
          title: 'Customer Access Required',
          description: 'You need customer privileges to access this area.',
          icon: 'warning' as const,
          iconColor: 'text-red-600',
          bgColor: 'bg-red-100',
        };
      case 'CLIENT_FETCH_ERROR':
        return {
          title: 'Connection Error',
          description: 'Unable to connect to the authentication server. Please check your internet connection and try again.',
          icon: 'warning' as const,
          iconColor: 'text-red-600',
          bgColor: 'bg-red-100',
        };
      default:
        return {
          title: 'Authentication Error',
          description: 'An error occurred during authentication. Please try again.',
          icon: 'warning' as const,
          iconColor: 'text-red-600',
          bgColor: 'bg-red-100',
        };
    }
  };

  const errorInfo = getErrorMessage(error);
  const { title, description, icon, iconColor, bgColor, showSignOut } = errorInfo;

  return (
    <div className="flex-1 bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full ${bgColor}`}>
            <Icon type={icon} className={iconColor} size="lg" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
            {title}
          </h2>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card>
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-6">
              {description}
            </p>
            
            <div className="space-y-3">
              {showSignOut ? (
                <Link href="/auth/signout" className="block">
                  <Button variant="primary" className="w-full">
                    <Icon type="x" className="mr-2" size="sm" />
                    Sign Out
                  </Button>
                </Link>
              ) : (
                <Link href="/auth/signin" className="block">
                  <Button variant="primary" className="w-full">
                    Back To Sign In
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </Card>
        
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Need help?{' '}
            <Link href="/contact" className="font-medium text-primary-600 hover:text-primary-500">
              Contact Support
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AuthErrorContent />
    </Suspense>
  );
}
