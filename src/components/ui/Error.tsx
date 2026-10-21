import React from 'react';
import Icon from '@/components/ui/Icon';
import Button from '@/components/ui/Button';

interface ErrorProps {
  size?: 'sm' | 'md' | 'lg';
  title?: string;
  message?: string;
  className?: string;
  showIcon?: boolean;
  onClick?: () => void;
}

const Error: React.FC<ErrorProps> = ({ 
  size = 'md', 
  title = 'Error',
  message = 'Something went wrong. Please try again.',
  className = '',
  showIcon = true,
  onClick = undefined
}) => {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  const iconSizeClasses = {
    sm: 'sm',
    md: 'md',
    lg: 'lg',
    xl: 'xl',
    xxl: 'xxl',
  };

  const titleSizeClasses = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl',
  };

  return (
    <div className={`flex flex-col items-center justify-center space-y-3 text-center ${className}`}>
      {showIcon && (
        <Icon 
          type="warning" 
          size={iconSizeClasses[size] as any}
          className="text-red-500 mx-auto mb-4" 
        />
      )}
      <div className="space-y-1">
        <h3 className={`font-semibold text-gray-700 ${titleSizeClasses[size]}`}>
          {title}
        </h3>
        {message && (
          <p className={`text-gray-600/80 ${sizeClasses[size]}`}>
            {message}
          </p>
        )}
        {onClick && (
          <Button
            onClick={onClick}
            variant="primary"
            >
            Try Again
          </Button>
        )}
      </div>
    </div>
  );
};

export default Error;
