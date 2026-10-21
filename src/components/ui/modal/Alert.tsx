import React from 'react';
import Icon, { IconType } from '@/components/ui/Icon';

interface AlertProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'outline';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  icon?: IconType | false;
}

const Alert: React.FC<AlertProps> = ({ 
  children, 
  variant = 'primary', 
  icon = undefined,
  size = 'md', 
  className = '',
  ...props
}) => {
  const baseClasses = 'w-full items-center font-medium rounded-2xl flex gap-2 text-sm transition-colors duration-300 border backdrop-blur-sm';

  const variantClasses = {
    primary: 'bg-[rgba(141,119,247,0.16)] text-[rgba(96,71,201,0.95)] border-white/75',
    secondary: 'bg-[rgba(255,255,255,0.4)] text-[rgba(26,26,26,0.82)] border-white/75',
    success: 'bg-[rgba(74,159,126,0.15)] text-[rgba(42,115,88,0.95)] border-white/75',
    warning: 'bg-[rgba(216,162,74,0.2)] text-[rgba(125,88,28,0.96)] border-white/75',
    danger: 'bg-[rgba(224,85,102,0.15)] text-[rgba(147,34,49,0.96)] border-white/75',
    outline: 'text-[rgba(26,26,26,0.75)] bg-[rgba(255,255,255,0.3)] border-white/80'
  };

  const variantIcons = {
    primary: 'info',
    secondary: 'info',
    success: 'check',
    warning: 'warning',
    danger: 'x',
    outline: 'info'
  } as const;

  const sizeClasses = {
    xs: 'px-1 py-2 text-xs',
    sm: 'px-2 py-2 text-xs',
    md: 'px-3 py-3 text-sm',
    lg: 'px-4 py-4 text-base'
  };

  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

  // Determine which icon to show: custom icon prop, default variant icon, or no icon
  const iconToShow = icon !== undefined ? icon : variantIcons[variant];

  return (
    <div className={classes} {...props}>
      {iconToShow && <Icon type={iconToShow} />}
      {children}
    </div>
  );
};

export default Alert;
