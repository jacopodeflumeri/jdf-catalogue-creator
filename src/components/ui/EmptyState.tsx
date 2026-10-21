import React from 'react';
import Icon, { IconType } from '@/components/ui/Icon';

interface EmptyStateProps {
  icon?: IconType;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`text-center py-12 px-6 glass-card ${className}`}>
      {icon && (
        <div className="inline-flex items-center justify-center w-16 h-16 bg-white/70 border border-white/75 rounded-full mb-4 shadow-[0_8px_18px_rgba(141,119,247,0.1)]">
          <Icon type={icon} size="xl" className="text-[#1a1a1a]/40" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-[#1a1a1a] mb-2">{title}</h3>
      {description && (
        <p className="text-[#1a1a1a]/60">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
