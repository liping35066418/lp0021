import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Plus,
} from 'lucide-react';
import { useState, useMemo, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import Empty from './Empty';
import Loading from './Loading';

export interface Column<T> {
  key: string;
  title: string;
  dataIndex: keyof T | string;
  render?: (value: unknown, record: T, index: number) => ReactNode;
  sortable?: boolean;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  ellipsis?: boolean;
}

export interface Action<T> {
  key: string;
  label: string;
  icon?: ReactNode;
  onClick: (record: T) => void;
  danger?: boolean;
  hidden?: (record: T) => boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  rowKey: keyof T | ((record: T) => string);
  pagination?: boolean;
  pageSize?: number;
  showSearch?: boolean;
  searchPlaceholder?: string;
  searchKeys?: (keyof T)[];
  actions?: Action<T>[];
  onAdd?: () => void;
  addButtonText?: string;
  toolbar?: ReactNode;
  emptyText?: string;
  className?: string;
  onRowClick?: (record: T) => void;
}

export default function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  loading = false,
  rowKey,
  pagination = true,
  pageSize = 10,
  showSearch = true,
  searchPlaceholder = '搜索...',
  searchKeys,
  actions,
  onAdd,
  addButtonText = '新增',
  toolbar,
  emptyText = '暂无数据',
  className,
  onRowClick,
}: DataTableProps<T>) {
  const [searchText, setSearchText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);

  const getRowKey = (record: T): string => {
    if (typeof rowKey === 'function') {
      return rowKey(record);
    }
    return String(record[rowKey]);
  };

  const filteredData = useMemo(() => {
    if (!searchText.trim()) return data;

    const keys = searchKeys || (columns.map((col) => col.dataIndex) as (keyof T)[]);

    return data.filter((item) =>
      keys.some((key) => {
        const value = item[key];
        return value != null && String(value).toLowerCase().includes(searchText.toLowerCase());
      })
    );
  }, [data, searchText, searchKeys, columns]);

  const sortedData = useMemo(() => {
    if (!sortField || !sortOrder) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortOrder === 'asc' ? -1 : 1;
      if (bVal == null) return sortOrder === 'asc' ? 1 : -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();

      return sortOrder === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [filteredData, sortField, sortOrder]);

  const totalPages = Math.ceil(sortedData.length / pageSize);
  const currentPageData = useMemo(() => {
    if (!pagination) return sortedData;
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize, pagination]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      if (sortOrder === 'asc') {
        setSortOrder('desc');
      } else if (sortOrder === 'desc') {
        setSortField(null);
        setSortOrder(null);
      }
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
    setCurrentPage(1);
  };

  const renderCell = (column: Column<T>, record: T, index: number) => {
    const value = record[column.dataIndex as keyof T];
    if (column.render) {
      return column.render(value, record, index);
    }
    return value as ReactNode;
  };

  const allColumns = useMemo((): Column<T>[] => {
    if (!actions || actions.length === 0) return columns;
    return [
      ...columns,
      {
        key: '__actions',
        title: '操作',
        dataIndex: '__actions',
        width: '120px',
        align: 'center',
        render: (_: unknown, record: T) => (
          <div className="flex items-center justify-center gap-1">
            {actions
              .filter((action) => !action.hidden?.(record))
              .map((action) => (
                <button
                  key={action.key}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    action.onClick(record);
                  }}
                  className={cn(
                    'px-2 py-1 text-xs font-medium rounded-md transition-colors',
                    action.danger
                      ? 'text-red-600 hover:bg-red-50'
                      : 'text-blue-600 hover:bg-blue-50'
                  )}
                >
                  {action.icon && <span className="mr-1">{action.icon}</span>}
                  {action.label}
                </button>
              ))}
          </div>
        ),
      },
    ];
  }, [columns, actions]);

  return (
    <div className={cn('bg-white rounded-xl shadow-sm border border-gray-200', className)}>
      {(showSearch || onAdd || toolbar) && (
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b border-gray-100">
          <div className="flex flex-wrap items-center gap-3">
            {showSearch && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchText}
                  onChange={handleSearchChange}
                  className="w-64 pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>
            )}
            {toolbar}
          </div>
          {onAdd && (
            <button
              type="button"
              onClick={onAdd}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {addButtonText}
            </button>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {allColumns.map((column) => (
                <th
                  key={column.key}
                  style={{ width: column.width }}
                  className={cn(
                    'px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200',
                    column.align === 'center' && 'text-center',
                    column.align === 'right' && 'text-right',
                    column.sortable && 'cursor-pointer select-none hover:bg-gray-100 transition-colors'
                  )}
                  onClick={() => column.sortable && handleSort(column.dataIndex as string)}
                >
                  <div
                    className={cn(
                      'inline-flex items-center gap-1',
                      column.align === 'center' && 'justify-center',
                      column.align === 'right' && 'justify-end'
                    )}
                  >
                    {column.title}
                    {column.sortable && (
                      <span className="text-gray-400">
                        {sortField === column.dataIndex ? (
                          sortOrder === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={allColumns.length} className="py-16">
                  <Loading text="加载中..." />
                </td>
              </tr>
            ) : currentPageData.length === 0 ? (
              <tr>
                <td colSpan={allColumns.length} className="py-16">
                  <div className="flex flex-col items-center gap-2">
                    <Empty />
                    <p className="text-sm text-gray-500">{emptyText}</p>
                  </div>
                </td>
              </tr>
            ) : (
              currentPageData.map((record, index) => (
                <tr
                  key={getRowKey(record)}
                  className={cn(
                    'hover:bg-gray-50 transition-colors',
                    onRowClick && 'cursor-pointer'
                  )}
                  onClick={() => onRowClick?.(record)}
                >
                  {allColumns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        'px-4 py-3 text-sm text-gray-700',
                        column.align === 'center' && 'text-center',
                        column.align === 'right' && 'text-right',
                        column.ellipsis && 'max-w-xs truncate'
                      )}
                      title={column.ellipsis ? String(record[column.dataIndex as keyof T] ?? '') : undefined}
                    >
                      {renderCell(column, record, index)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && sortedData.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 border-t border-gray-100">
          <div className="text-sm text-gray-500">
            共 <span className="font-medium text-gray-700">{sortedData.length}</span> 条，
            第 <span className="font-medium text-gray-700">{currentPage}</span> /
            <span className="font-medium text-gray-700">{totalPages || 1}</span> 页
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              className="p-1.5 text-gray-600 rounded-md hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-1.5 text-gray-600 rounded-md hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1 mx-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => handlePageChange(pageNum)}
                    className={cn(
                      'min-w-8 h-8 px-2 text-sm font-medium rounded-md transition-colors',
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-1.5 text-gray-600 rounded-md hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-1.5 text-gray-600 rounded-md hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function DataTableSkeleton({ columns = 5, rows = 8 }: { columns?: number; rows?: number }) {
  const searchWidth = 'w-64';
  const buttonWidth = 'w-24';
  const height = 'h-9';
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className={`${searchWidth} ${height} bg-gray-100 rounded-lg animate-pulse`} />
          <div className={`${buttonWidth} ${height} bg-gray-100 rounded-lg animate-pulse`} />
        </div>
      </div>
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-4 py-3">
                <div className="h-4 bg-gray-200 rounded w-20 animate-pulse" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td key={colIndex} className="px-4 py-3">
                  <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
