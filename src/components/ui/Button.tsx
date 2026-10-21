import React from 'react';
import { ButtonProps } from '@/types';
import Loading from '@/components/ui/Loading';

type ExtendedButtonVariant = NonNullable<ButtonProps['variant']> | 'icon';

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  className = '',
  title = '',
  ...props
}) => {
  const resolvedVariant = variant as ExtendedButtonVariant;
  const isManagedVariant =
    resolvedVariant === 'override' ||
    resolvedVariant === 'overrideNoBorder' ||
    resolvedVariant === 'menuActive' ||
    resolvedVariant === 'menuInactive';

  const baseClasses = isManagedVariant
    ? ''
    : 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-300 focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(141,119,247,0.2)] disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-px';

  const variantClasses: Record<ExtendedButtonVariant, string> = {
    primary: 'prism-button',
    primaryDisabled: 'prism-button opacity-45 text-white/70',
    secondary: 'frost-button text-[#1a1a1a]/80',
    danger:
      'bg-[rgba(224,85,102,0.15)] text-[rgba(154,43,62,0.95)] border border-[rgba(224,85,102,0.35)] hover:bg-[rgba(224,85,102,0.25)]',
    ghost: 'ghost-button',
    outline:
      'ghost-button border-white/70 text-[rgba(26,26,26,0.78)]',
    icon: 'prism-button !rounded-full w-10 h-10 p-0',
    simple:
      'border border-white/80 bg-[rgba(255,255,255,0.22)] text-[rgba(26,26,26,0.82)]',
    colorful:
      'border border-white/80 text-[rgba(26,26,26,0.82)] bg-[linear-gradient(135deg,rgba(255,255,255,0.56),rgba(141,119,247,0.16))]',
    circle:
      'border border-white/80 rounded-full p-0 aspect-square text-current bg-white/45 backdrop-blur-sm',
    none: '',
    override:
      'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-300 border border-transparent text-current',
    overrideNoBorder:
      'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-300 text-current',
    menuActive:
      'inline-flex items-center text-sm font-semibold rounded-xl transition-all duration-300 relative bg-[rgba(255,255,255,0.58)] text-primary border border-white/85 shadow-[0_2px_10px_rgba(141,119,247,0.12)]',
    menuInactive:
      'inline-flex items-center text-sm font-medium rounded-xl transition-all duration-300 relative text-[rgba(26,26,26,0.72)] hover:text-[#1a1a1a] hover:bg-[rgba(255,255,255,0.3)]',
  };

  const sizeClasses = {
    xxs: 'px-0 py-0 text-xs',
    xsm: 'px-0 py-0 text-sm',
    xsmd: 'px-1 py-1 text-xs',
    xs: 'px-2.5 py-1.5 text-xs',
    sm: 'px-4 py-2.5 text-sm',
    md: 'px-6 py-3 text-sm',
    lg: 'px-8 py-4 text-base',
  };

  const classes = `${baseClasses} ${variantClasses[resolvedVariant]} ${sizeClasses[size]} ${className}`.trim();

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      onClick={onClick}
      title={title}
      {...props}
    >
      {loading ? (
        <>
          <Loading noText size="sm" className="mr-2" />
          <span>Loading...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
};

export default Button;
