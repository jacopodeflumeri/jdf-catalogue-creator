import React from 'react';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  variant?:
    | 'primary'
    | 'primarydark'
    | 'secondary'
    | 'success'
    | 'warning'
    | 'danger'
    | 'purple'
    | 'blue'
    | 'gray'
    | 'outline';
  size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg';
}

const Badge: React.FC<BadgeProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '',
  ...props
}) => {
  const baseClasses = 'inline-flex items-center font-medium rounded-full border backdrop-blur-sm';
  
  const variantClasses = {
    primary: 'bg-[rgba(141,119,247,0.16)] text-primary border-white/70',
    primarydark: 'bg-[rgba(108,82,214,0.84)] text-white border-white/35',
    secondary: 'bg-[rgba(127,244,224,0.22)] text-[rgba(26,26,26,0.76)] border-white/70',
    gray: 'bg-[rgba(255,255,255,0.46)] text-[rgba(26,26,26,0.68)] border-white/70',
    purple: 'bg-[rgba(141,119,247,0.12)] text-[rgba(108,82,214,0.92)] border-white/70',
    blue: 'bg-[rgba(77,139,201,0.14)] text-[rgba(56,98,142,0.95)] border-white/70',
    success: 'bg-[rgba(74,159,126,0.14)] text-[rgba(42,115,88,0.95)] border-white/70',
    warning: 'bg-[rgba(216,162,74,0.2)] text-[rgba(125,88,28,0.96)] border-white/70',
    danger: 'bg-[rgba(224,85,102,0.16)] text-[rgba(147,34,49,0.96)] border-white/70',
    outline: 'text-[rgba(26,26,26,0.68)] bg-[rgba(255,255,255,0.3)] border-white/80',
  };

  const sizeClasses = {
    xxs: 'px-1 py-0.5 text-xs',
    xs: 'px-2 py-0.5 text-xs',
    sm: 'px-2.5 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base'
  };

  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

  return (
    <span className={classes} {...props}>
      {children}
    </span>
  );
};

export default Badge;
