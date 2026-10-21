import React from 'react';

interface LoadingProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  text?: string;
  noText?: boolean;
  className?: string;
  textClassName?: string;
  variant?: 'primary' | 'secondary' | 'accent' | 'warning';
  skeleton?: 'text' | 'card' | 'row';
}

const Loading: React.FC<LoadingProps> = ({
  size = 'md',
  text = 'Loading...',
  noText = false,
  className = '' ,
  textClassName = 'text-[#1a1a1a]/65',
  variant = 'primary',
  skeleton
}) => {
  if (skeleton === 'text') {
    return <div className={`ds-skeleton rounded-xl h-4 w-3/4 ${className}`} />;
  }
  if (skeleton === 'card') {
    return (
      <div className={`ds-skeleton rounded-2xl h-32 w-full ${className}`} />
    );
  }
  if (skeleton === 'row') {
    return (
      <div className={`ds-skeleton rounded-xl h-12 w-full ${className}`} />
    );
  }

  const sizeClasses = {
    xs: 'w-2 h-2',
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  const textSizeClasses = {
    xs: 'text-xs',
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-md',
  };

  const borderSizeClasses = {
    xs: 'border-2',
    sm: 'border-3',
    md: 'border-4',
    lg: 'border-4',
  };

  const variantClasses = {
    primary: 'border-t-primary',
    secondary: 'border-t-secondary',
    accent: 'border-t-[#4D8BC9]',
    warning: 'border-t-[#D8A24A]',
  };

  return (
    <div className={`flex flex-col items-center justify-center space-y-2 ${className}`}>
      <div className={`animate-spin ${borderSizeClasses[size]} border-white/70 ${variantClasses[variant]} rounded-full ${sizeClasses[size]}`}></div>
      {text && !noText && (
        <p className={`${textClassName} ${textSizeClasses[size]}`}>{text}</p>
      )}
    </div>
  );
};

export default Loading;
