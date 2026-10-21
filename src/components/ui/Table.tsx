import React, { useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import Loading from '@/components/ui/Loading';
import Pagination from '@/components/ui/Pagination';
import { TableProps } from '@/types';

const textAlignClasses = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
} as const;

const flexAlignClasses = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
} as const;

function Table<T extends Record<string, unknown>>({
  data,
  columns,
  loading = false,
  pagination,
  onRowClick,
  className = '',
  sortable = false,
  defaultSortKey,
  defaultSortOrder = 'asc',
  onSort,
  emptyState,
}: TableProps<T>) {
  const [sortKey, setSortKey] = useState<keyof T | null>(defaultSortKey || null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(defaultSortOrder);
  const [internalPage, setInternalPage] = useState<number>(1);

  const handleSort = (key: keyof T) => {
    if (!sortable) return;

    const newSortOrder = sortKey === key && sortOrder === 'asc' ? 'desc' : 'asc';
    setSortKey(key);
    setSortOrder(newSortOrder);

    if (pagination) {
      if (pagination.onPageChange) {
        pagination.onPageChange(1);
      } else {
        setInternalPage(1);
      }
    }

    onSort?.(key, newSortOrder);
  };

  const handlePageChange = (page: number) => {
    if (pagination?.onPageChange) {
      pagination.onPageChange(page);
    } else {
      setInternalPage(page);
    }
  };

  const sortedData = useMemo(() => {
    if (!sortable || !sortKey || onSort) {
      return data;
    }

    return [...data].sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];

      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortOrder === 'asc' ? 1 : -1;
      if (bValue == null) return sortOrder === 'asc' ? -1 : 1;

      if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
        if (aValue === bValue) return 0;
        return sortOrder === 'asc' ? (aValue ? 1 : -1) : (aValue ? -1 : 1);
      }

      const aNum = Number(aValue);
      const bNum = Number(bValue);
      if (!isNaN(aNum) && !isNaN(bNum) && isFinite(aNum) && isFinite(bNum)) {
        return sortOrder === 'asc' ? aNum - bNum : bNum - aNum;
      }

      const aDate = new Date(aValue as string);
      const bDate = new Date(bValue as string);
      if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
        return sortOrder === 'asc'
          ? aDate.getTime() - bDate.getTime()
          : bDate.getTime() - aDate.getTime();
      }

      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();

      if (aStr < bStr) return sortOrder === 'asc' ? -1 : 1;
      if (aStr > bStr) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortOrder, sortable, onSort]);

  const displayData = useMemo(() => {
    const dataToDisplay = onSort ? data : sortedData;

    if (pagination) {
      const currentPage = pagination.onPageChange ? pagination.page : internalPage;
      const startIndex = (currentPage - 1) * pagination.limit;
      return dataToDisplay.slice(startIndex, startIndex + pagination.limit);
    }

    return dataToDisplay;
  }, [data, sortedData, onSort, pagination, internalPage]);

  if (loading) {
    return (
      <div className="w-full ds-table-shell">
        <div className="px-6 py-12 text-center">
          <Loading />
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="w-full ds-table-shell">
        <div className="px-6 py-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/60 rounded-full border border-white/70 mb-4 shadow-[0_6px_18px_rgba(141,119,247,0.12)]">
            {emptyState?.icon || (
              <Icon type="content" size="xl" className="text-[#1a1a1a]/40" />
            )}
          </div>
          <h3 className="text-lg font-semibold text-[#1a1a1a] mb-2">
            {emptyState?.title || 'No data found'}
          </h3>
          <p className="text-[#1a1a1a]/60">
            {emptyState?.description || 'There are no records to display.'}
          </p>
          {emptyState?.action && <div className="mt-4">{emptyState.action}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full ds-table-shell overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="ds-table-head">
            <tr>
              {columns.map((column) => {
                const isSortable = sortable && column.sortable === true;
                const isCurrentSort = sortKey === column.key;
                const textAlign = column.align || 'left';
                const alignClass = textAlignClasses[textAlign];
                const flexAlign = flexAlignClasses[textAlign];

                return (
                  <th
                    key={String(column.key)}
                    className={`px-6 py-3 ${alignClass} text-xs font-semibold text-[#1a1a1a]/55 uppercase tracking-wider ${isSortable ? 'cursor-pointer hover:bg-white/40 select-none transition-colors duration-300' : ''}`}
                    style={{ width: column.width }}
                    onClick={() => isSortable && handleSort(column.key)}
                  >
                    <div className={`flex ${flexAlign} items-center gap-1`}>
                      <span>{column.title}</span>
                      {isSortable && (
                        <div className="flex flex-col">
                          <Icon
                            type="chevron-up"
                            size="xs"
                            className={`transition-colors ${
                              isCurrentSort && sortOrder === 'asc'
                                ? 'text-primary'
                                : 'text-[#1a1a1a]/35'
                            }`}
                          />
                          <Icon
                            type="chevron-down"
                            size="xs"
                            className={`-mt-1 transition-colors ${
                              isCurrentSort && sortOrder === 'desc'
                                ? 'text-primary'
                                : 'text-[#1a1a1a]/35'
                            }`}
                          />
                        </div>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {displayData.map((row, index) => (
              <tr
                key={index}
                className={`ds-table-row ${onRowClick ? 'cursor-pointer' : ''}`}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((column) => {
                  const alignClass = textAlignClasses[column.align || 'left'];
                  return (
                    <td
                      key={String(column.key)}
                      className={`px-6 py-4 whitespace-nowrap text-sm text-[#1a1a1a] ${alignClass}`}
                    >
                      {column.render
                        ? column.render(row[column.key], row)
                        : row[column.key] == null
                          ? '-'
                          : String(row[column.key])}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && (
        <Pagination
          page={pagination.onPageChange ? pagination.page : internalPage}
          limit={pagination.limit}
          total={pagination.total}
          onPageChange={handlePageChange}
          maxVisiblePages={3}
          showResultsText={true}
          variant="transparent"
        />
      )}
    </div>
  );
}

export default Table;
