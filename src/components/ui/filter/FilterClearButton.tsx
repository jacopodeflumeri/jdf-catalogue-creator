'use client';

import Icon from '../Icon';

interface FilterClearButtonProps {
  onClick: () => void;
  className?: string;
  title?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function FilterClearButton({
  onClick,
  className = '',
  title = 'Clear all filters',
  size = 'md'
}: FilterClearButtonProps) {

  const paddingClasses = {
    sm: 'p-2',
    md: 'p-3',
    lg: 'p-4',
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center ${paddingClasses[size]} frost-button rounded-xl hover:bg-white/75 transition-all duration-300 flex-shrink-0 ${className}`}
      title={title}
    >
      <Icon type="refresh" size={size} className="text-[#1a1a1a]/65" />
    </button>
  );
}
