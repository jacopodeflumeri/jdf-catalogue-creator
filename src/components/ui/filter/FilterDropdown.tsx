'use client';

import { useState, useRef, useEffect } from 'react';
import Icon from '../Icon';
import { IconType } from '../Icon';

export interface FilterDropdownProps {
    label: string;
    icon?: IconType;
    activeFilters?: string[];
    showFullActiveFilters?: boolean;
    allFiltersText?: string;
    children: React.ReactNode;
    className?: string;
    size?: 'sm' | 'md' | 'lg';
}

export default function FilterDropdown({
    label,
    icon,
    activeFilters = [],
    showFullActiveFilters = true,
    allFiltersText = 'All',
    children,
    className = '',
    size = 'md'
}: FilterDropdownProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const sizeClasses = {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base',
    };

    const paddingClasses = {
        sm: 'p-2',
        md: 'p-3',
        lg: 'p-4',
    };

    const countSizeClasses = {
        sm: 'text-[10px]',
        md: 'text-xs',
        lg: 'text-sm',
    };

    const countPaddingClasses = {
        sm: 'px-1',
        md: 'px-2 py-0.5',
        lg: 'px-2 py-1',
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsExpanded(false);
            }
        };

        if (isExpanded) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isExpanded]);

    return (
        <div ref={dropdownRef} className={`relative ${className}`}>
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`w-full flex items-center justify-between ${paddingClasses[size]} frost-button rounded-xl hover:bg-white/75 transition-all duration-300`}
            >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    {icon && <Icon type={icon} size="sm" className="text-[#1a1a1a]/65 flex-shrink-0" />}
                    <span className={`${sizeClasses[size]}  font-medium text-[#1a1a1a]/80 flex-shrink-0`}>{label}</span>

                    {/* Active Filters Display */}
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                        {showFullActiveFilters ? (
                            // Show all active filters as badges
                            activeFilters.length > 0 ? (
                                activeFilters.map((filter, index) => (
                                    <span
                                        key={index}
                                        className="px-2 py-0.5 bg-[rgba(141,119,247,0.16)] text-primary border border-white/75 rounded-full text-xs font-medium truncate max-w-[150px]"
                                        title={filter}
                                    >
                                        {filter}
                                    </span>
                                ))
                            ) : (
                                <span className={`${countSizeClasses[size]}  text-[#1a1a1a]/50`}>{allFiltersText}</span>
                            )
                        ) : (
                            // Show count badge
                            activeFilters.length > 0 ? (
                                <span className={`${countPaddingClasses[size]} bg-[rgba(141,119,247,0.16)] text-primary border border-white/75 rounded-full ${countSizeClasses[size]}`}>
                                    {activeFilters.length}
                                </span>
                            ) : (
                                <span className={`${countSizeClasses[size]} text-[#1a1a1a]/50`}>{allFiltersText}</span>
                            )
                        )}
                    </div>
                </div>

                <Icon
                    type={isExpanded ? "chevron-up" : "chevron-down"}
                    size="sm"
                    className="text-[#1a1a1a]/50 transition-transform duration-300 flex-shrink-0 ml-2"
                />
            </button>

            {/* Floating Dropdown Content */}
            {isExpanded && (
                <div className="absolute w-fit top-full left-0 right-0 mt-2 p-4 bg-white/88 border border-white/80 backdrop-blur-xl rounded-xl shadow-[0_8px_24px_rgba(141,119,247,0.14)] z-50 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex flex-col gap-2">
                        {children}
                    </div>
                </div>
            )}
        </div>
    );
}
