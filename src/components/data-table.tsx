'use client'

import { motion } from 'framer-motion'
import { type ReactNode } from 'react'
import { easeOut } from './reveal'
import { EmptyState, ErrorBlock, LoadingBlock, Pagination } from './ui-primitives'

export interface Column<T> {
  key: string
  header: ReactNode
  render: (row: T) => ReactNode
  sortable?: boolean
  width?: string
  align?: 'start' | 'end' | 'center'
  hideOnMobile?: boolean
}

interface DataTableProps<T> {
  columns: Array<Column<T>>
  rows: T[]
  rowKey: (row: T) => string
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  empty?: { title: string; description: string; action?: ReactNode }
  sort?: { key: string; order: 'asc' | 'desc' }
  onSortChange?: (key: string) => void
  page?: number
  pageSize?: number
  total?: number
  onPage?: (p: number) => void
  toolbar?: ReactNode
  stagger?: boolean
}

/**
 * Reusable data table: server-side sorting/pagination hooks, loading/empty/error
 * states, staggered first render, responsive horizontal scroll.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  empty,
  sort,
  onSortChange,
  page,
  pageSize,
  total,
  onPage,
  toolbar,
  stagger = true,
}: DataTableProps<T>) {
  if (loading && rows.length === 0) {
    return (
      <div className="card overflow-hidden">
        {toolbar && <div className="border-b border-hairline p-4">{toolbar}</div>}
        <LoadingBlock />
      </div>
    )
  }

  if (error && rows.length === 0) {
    return (
      <div className="card overflow-hidden">
        {toolbar && <div className="border-b border-hairline p-4">{toolbar}</div>}
        <ErrorBlock message={error} onRetry={onRetry} />
      </div>
    )
  }

  if (rows.length === 0 && empty) {
    return (
      <div className="card overflow-hidden">
        {toolbar && <div className="border-b border-hairline p-4">{toolbar}</div>}
        <EmptyState title={empty.title} description={empty.description} action={empty.action} />
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      {toolbar && <div className="border-b border-hairline p-4">{toolbar}</div>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-hairline bg-surface/60">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={`px-4 py-2.5 text-start text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft ${col.align === 'end' ? 'text-end' : ''} ${col.hideOnMobile ? 'hidden md:table-cell' : ''}`}
                  style={col.width ? { width: col.width } : undefined}
                  aria-sort={sort && col.sortable && sort.key === col.key ? (sort.order === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {col.sortable && onSortChange ? (
                    <button
                      onClick={() => onSortChange(col.key)}
                      className="inline-flex items-center gap-1 rounded transition-colors hover:text-ink"
                    >
                      {col.header}
                      <span className={`text-[10px] transition-opacity ${sort?.key === col.key ? 'opacity-100' : 'opacity-0'}`}>
                        {sort?.order === 'asc' ? '▲' : '▼'}
                      </span>
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <motion.tr
                key={rowKey(row)}
                initial={stagger ? { opacity: 0, y: 6 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...easeOut, delay: stagger ? Math.min(index * 0.03, 0.4) : 0 }}
                className="group border-b border-hairline transition-colors last:border-0 hover:bg-surface/50"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 align-middle ${col.align === 'end' ? 'text-end' : ''} ${col.hideOnMobile ? 'hidden md:table-cell' : ''}`}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      {page !== undefined && pageSize !== undefined && total !== undefined && onPage && (
        <Pagination page={page} pageSize={pageSize} total={total} onPage={onPage} />
      )}
    </div>
  )
}
