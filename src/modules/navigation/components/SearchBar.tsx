'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Icon from '@/components/ui/Icon';
import Loading from '@/components/ui/Loading';
import { SearchResult } from '@/types';
import { searchPages } from '@/lib/actions/search/search-actions';
import Badge from '@/components/ui/Badge';
import logger from '@/lib/utils/logger';

interface SearchBarProps {
  placeholder?: string;
  className?: string;
  customerAccount?: any; // Replace with actual type if available
  customerDashboardData?: any; // Replace with actual type if available
  resultsPosition?: 'left' | 'right' | 'center';
  resultsWidth?: string;
}

export default function SearchBar({
  placeholder = "Search pages...",
  className = "",
  customerAccount = null,
  customerDashboardData = null,
  resultsPosition = 'center',
  resultsWidth = 'w-full'
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();
  const { data: session } = useSession();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle search with loading state and error handling
  const handleSearch = (searchQuery: string) => {
    // Clear results if query is too short
    if (searchQuery.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    // Don't search if already pending
    if (isPending) {
      return;
    }

    startTransition(async () => {
      try {
        const searchResponse = await searchPages(searchQuery, session?.user?.role, {
          customerAccount: customerAccount,
          customerDashboardData: customerDashboardData
        });

        const limitedResults = searchResponse.results.slice(0, 20); // Limit to 20 results
        setResults(limitedResults);
        setIsOpen(limitedResults.length > 0);
      } catch (error) {
        logger.error('Search error:', error);
        setResults([]);
        setIsOpen(false);
      }
    });
  };

  // Handle input change with proper debouncing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    // Clear previous timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new timeout for debounced search
    debounceTimeoutRef.current = setTimeout(() => {
      handleSearch(value);
    }, 300);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // Handle result selection
  const handleResultClick = (result: SearchResult) => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    router.push(result.url);
  };

  // Handle keyboard navigation and search
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setResults([]);
      inputRef.current?.blur();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // If there are results, navigate to the first one
      if (results.length > 0) {
        handleResultClick(results[0]);
      } else if (query.trim().length >= 2) {
        // Otherwise, force a search
        handleSearch(query);
      }
    }
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'page': return 'content';
      case 'module': return 'rocket';
      case 'account': return 'user';
      case 'blog': return 'external-link';
      default: return 'search';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'page': return 'Pages';
      case 'module': return 'Modules';
      case 'account': return 'Account';
      case 'blog': return 'Blog Posts';
      default: return 'Other';
    }
  };

  const getTypePriority = (type: string) => {
    switch (type) {
      case 'page': return 1;
      case 'account': return 2;
      case 'module': return 3;
      case 'blog': return 999; // Blog posts always last
      default: return 500;
    }
  };

  // Group results by type
  const groupedResults = results.reduce((groups: { [key: string]: SearchResult[] }, result) => {
    const type = result.type;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(result);
    return groups;
  }, {});

  // Sort grouped results by priority
  const sortedGroupedResults = Object.entries(groupedResults).sort(([typeA], [typeB]) => {
    return getTypePriority(typeA) - getTypePriority(typeB);
  });

  // Get positioning classes for results dropdown
  const getResultsPositionClasses = () => {
    const baseClasses = `absolute z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto ${resultsWidth}`;
    
    switch (resultsPosition) {
      case 'left':
        return `${baseClasses} right-0`;
      case 'right':
        return `${baseClasses} left-0`;
      case 'center':
      default:
        return `${baseClasses} left-1/2 transform -translate-x-1/2`;
    }
  };

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Icon
            type="search"
            className={`h-4 w-4 transition-colors ${isPending ? 'text-primary-500' : 'text-gray-400'
              }`}
          />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (query.length >= 2) {
              if (results.length > 0) {
                setIsOpen(true);
              } else {
                // Trigger a search if we have a query but no results
                handleSearch(query);
              }
            }
          }}
          placeholder={placeholder}
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
        />

        {/* Loading indicator */}
        {isPending && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <Loading noText size="sm"  />
          </div>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div className={getResultsPositionClasses()}>
          {sortedGroupedResults.map(([type, typeResults], _typeIndex) => (
            <div key={type}>
              {/* Type Header */}
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 first:rounded-t-lg">
                <div className="flex items-center space-x-2">
                  <Icon
                    type={getResultIcon(type)}
                    className="h-3 w-3 text-gray-500"
                  />
                  <span className="text-xs font-medium text-gray-700 uppercase tracking-wider">
                    {getTypeLabel(type)} ({typeResults.length})
                  </span>
                </div>
              </div>

              {/* Results for this type */}
              {typeResults.map((result, _resultIndex) => (
                <button
                  key={result.id}
                  onClick={() => handleResultClick(result)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0 transition-colors"
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">

                        <div className="text-sm font-medium text-gray-900 truncate">
                          {result.title}
                        </div>
                        <Badge
                          variant="primary"
                          className="ml-2"
                          size='sm'
                        >
                          {result.type.charAt(0).toUpperCase() + result.type.slice(1)}
                        </Badge>
                      </div>



                      {result.description && (
                        <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {result.description}
                        </div>
                      )}

                      <div className="text-xs text-gray-400 mt-1 line-clamp-1">
                        {result.url}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* No results message */}
      {isOpen && query.length >= 2 && results.length === 0 && !isPending && (
        <div className={`${getResultsPositionClasses()} px-4 py-6 text-center`}>
          <Icon type="search" className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">
            No results found for &quot;{query}&quot;
          </p>
        </div>
      )}
    </div>
  );
}
