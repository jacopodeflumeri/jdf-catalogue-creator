import React from 'react';
import { CardProps } from '@/types';

const Card: React.FC<CardProps> = ({
  children,
  title,
  description,
  footer,
  hoverable = false,
  noPadding = false,
  noPaddingContent = false,
  canOverflow = false,
  noBg = false,
  className = '',
  onClick,
  isClickable = true,
  headerActions,
  ...props
}) => {
  const baseClasses = `${noBg ? '' : 'glass-card'} rounded-2xl ${canOverflow ? '' : 'overflow-hidden'}`;
  const hoverClasses = hoverable
    ? 'hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(141,119,247,0.16)] transition-all duration-300'
    : '';
  const clickableClasses = onClick && isClickable ? 'cursor-pointer' : '';
  const classes = `${baseClasses} ${hoverClasses} ${clickableClasses} ${className}`.trim();

  // Padding classes based on noPadding prop
  const headerPadding = noPadding ? '' : 'px-8 py-6';
  const contentPadding = (noPadding || noPaddingContent) ? '' : 'px-8 py-6';
  const footerPadding = noPadding ? '' : 'px-8 py-4';

  return (
    <div className={classes} onClick={onClick} {...props}>
      {(title || description || headerActions) && (
        <div className={`${headerPadding} border-b border-white/60`}>
          <div className="flex items-middle justify-between">
            <div className="flex-1 min-w-0">
              {title && (
                <h3 className="text-xl font-semibold text-[#1a1a1a] mb-2">{title}</h3>
              )}
              {description && (
                <p className="text-sm text-[#1a1a1a]/60 leading-relaxed">{description}</p>
              )}
            </div>

            {/* Header actions area - supports any React node */}
            {(headerActions) && (
              <div className="ml-4 flex-shrink-0 flex items-center justify-center gap-2">
                {headerActions}
              </div>
            )}
          </div>
        </div>
      )}
      
      {children && (
        <div className={contentPadding}>
          {children}
        </div>
      )}

      {footer && (
        <div className={`${footerPadding} bg-white/34 border-t border-white/60`}>
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card;
