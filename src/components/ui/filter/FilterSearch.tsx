'use client';

import Icon from '../Icon';

interface FilterSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function FilterSearch({ 
  value, 
  onChange, 
  placeholder = 'Search...', 
  className = '' 
}: FilterSearchProps) {
  return (
    <div className={`relative flex-1 min-w-[300px] ${className}`}>
      <div className="flex items-center gap-3 p-3 frost-button rounded-xl hover:bg-white/75 transition-all duration-300">
        <Icon type="search" size="sm" className="text-[#1a1a1a]/65 flex-shrink-0" />
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 text-sm text-[#1a1a1a] placeholder:text-[#1a1a1a]/45 bg-transparent border-none outline-none focus:ring-0 p-0"
        />
        {value && (
          <button
            onClick={() => onChange('')}
            className="flex-shrink-0 text-[#1a1a1a]/45 hover:text-[#1a1a1a]/70 transition-colors duration-300"
          >
            <Icon type="x" size="sm" />
          </button>
        )}
      </div>
    </div>
  );
}
