import React from 'react';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';

export interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  maxVisiblePages?: number;
  showResultsText?: boolean;
  className?: string;
  variant?: 'default' | 'white' | 'primary' | 'transparent';
}

export default function Pagination({
  page,
  limit,
  total,
  onPageChange,
  maxVisiblePages = 3,
  showResultsText = true,
  className = '',
  variant = 'default',
}: PaginationProps) {
  const totalPages = Math.ceil(total / limit);
  const startResult = (page - 1) * limit + 1;
  const endResult = Math.min(page * limit, total);

  if (totalPages <= 1) {
    return null;
  }

  const variantClasses = {
    default: 'bg-white/40 border-t border-white/60',
    white: 'bg-white/55 border-t border-white/65',
    primary: 'bg-[rgba(141,119,247,0.16)] border-t border-[rgba(141,119,247,0.28)]',
    transparent: 'border-t border-white/55',
  };

  const renderPageNumbers = () => {
    const currentPage = page;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    const pages: React.ReactNode[] = [];

    if (startPage > 1) {
      pages.push(
        <Button key={1} onClick={() => onPageChange(1)} variant="secondary" size="sm">
          1
        </Button>,
      );
      if (startPage > 2) {
        pages.push(
          <span key="start-ellipsis" className="text-[#1a1a1a]/50">
            ...
          </span>,
        );
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      const isActive = i === currentPage;
      pages.push(
        <Button
          key={i}
          onClick={() => onPageChange(i)}
          variant={isActive ? 'primary' : 'secondary'}
          size="sm"
        >
          {i}
        </Button>,
      );
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pages.push(
          <span key="end-ellipsis" className="text-[#1a1a1a]/50">
            ...
          </span>,
        );
      }
      pages.push(
        <Button
          key={totalPages}
          onClick={() => onPageChange(totalPages)}
          variant="secondary"
          size="sm"
        >
          {totalPages}
        </Button>,
      );
    }

    return pages;
  };

  return (
    <div className={`px-6 py-3 ${variantClasses[variant]} flex items-center justify-between gap-3 ${className}`}>
      {showResultsText ? (
        <div className="text-sm text-[#1a1a1a]/60">
          Showing {startResult} to {endResult} of {total} results
        </div>
      ) : (
        <div />
      )}

      <div className="flex items-center space-x-2">
        <Button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          variant="ghost"
          size="xsm"
          aria-label="Previous page"
        >
          <Icon type="arrow-left" size="sm" />
        </Button>

        {renderPageNumbers()}

        <Button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          variant="ghost"
          size="xsm"
          aria-label="Next page"
        >
          <Icon type="arrow-right" size="sm" />
        </Button>
      </div>
    </div>
  );
}
