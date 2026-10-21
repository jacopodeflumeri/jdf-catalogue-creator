'use client';

import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Loading from '@/components/ui/Loading';
import { config } from '@/config';

interface AuthErrorCardProps {
  type: 'session-expired' | 'authentication-failed' | 'generic-error';
  message?: string;
  variant: 'warning' | 'error';
  actions?: ('dashboard' | 'signin' | 'retry')[];
  onRetry?: () => void;
  autoRedirect?: boolean;
  autoRedirectDelay?: number;
  isModal?: boolean; // New prop to control layout
}

export default function AuthErrorCard({ 
  type,
  message,
  variant = 'error',
  actions = ['signin'],
  onRetry,
  autoRedirect = false,
  isModal = false // Default to full-page layout
}: AuthErrorCardProps) {
  const router = useRouter();

  const getTitle = () => {
    switch (type) {
      case 'session-expired':
        return 'Session Expired';
      case 'authentication-failed':
        return 'Authentication Failed';
      case 'generic-error':
        return 'Something Went Wrong';
      default:
        return 'Error';
    }
  };

  const getDefaultMessage = () => {
    switch (type) {
      case 'session-expired':
        return 'Your session has expired. To continue, please log back in.';
      case 'authentication-failed':
        return 'Authentication failed. Please try signing in again.';
      case 'generic-error':
        return 'An unexpected error occurred. Please try again.';
      default:
        return 'An error occurred.';
    }
  };

  const getIconConfig = () => {
    if (variant === 'warning') {
      return {
        bgColor: 'bg-yellow-100',
        iconColor: 'text-yellow-600'
      };
    }
    return {
      bgColor: 'bg-red-100',
      iconColor: 'text-red-600'
    };
  };

  const handleAdminSignIn = async () => {
    await signOut({ callbackUrl: '/auth/admin' });
  };

  const handleDashboard = () => {
    router.push('/admin');
  };

  const iconConfig = getIconConfig();

  // Conditional wrapper for modal vs full-page layout
  const content = (
    <Card className={isModal ? "w-full" : "max-w-md w-full"}>
      <div className="text-center space-y-4 p-6">
        <div className="flex justify-center">
          <div className={`w-16 h-16 ${iconConfig.bgColor} rounded-full flex items-center justify-center`}>
            <Icon type="warning" size="xl" className={iconConfig.iconColor} />
          </div>
        </div>
        
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{getTitle()}</h2>
          {config.app.isDevelopment && (
            <p className="text-gray-600 text-sm mb-2">{message || getDefaultMessage()}</p>
          )}
          {autoRedirect && (
            <p className="text-gray-500 text-xs">
              You will be automatically redirected shortly.
            </p>
          )}
        </div>

        <div className="flex gap-3 justify-center flex-wrap">
          {actions.includes('dashboard') && (
            <Button variant="outline" onClick={handleDashboard}>
              <Icon type="home" className="mr-2" size="sm" />
              Dashboard
            </Button>
          )}
          {actions.includes('signin') && (
            <Button variant="primary" onClick={handleAdminSignIn}>
              <Icon type="user" className="mr-2" size="sm" />
              Sign Out
            </Button>
          )}
          {actions.includes('retry') && onRetry && (
            <Button variant="outline" onClick={onRetry}>
              <Icon type="refresh" className="mr-2" size="sm" />
              Try Again
            </Button>
          )}
        </div>

        {autoRedirect && (
            <Loading size="sm" />
        )}
      </div>
    </Card>
  );

  // Return modal layout or full-page layout based on isModal prop
  if (isModal) {
    return content;
  }

  return (
    <div className="flex-1 h-screen bg-gray-50 flex items-center justify-center p-4">
      {content}
    </div>
  );
}
