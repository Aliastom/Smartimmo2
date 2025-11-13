import React, { useMemo, useState } from 'react'

export interface Column<T> {
  key: keyof T | 'actions'
  label: string
  sortable?: boolean
  render?: (item: T) => React.ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  searchPlaceholder?: string
}

export default function DataTable<T extends Record<string, any>>({ columns, data, searchPlaceholder = 'Rechercher...' }: DataTableProps<T>) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return data || []
    return (data || []).filter((row) => Object.values(row).some((v) => String(v).toLowerCase().includes(q)))
  }, [query, data])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageData = filtered.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div className="rounded-xl bg-base-100 shadow-card border border-neutral-200">
      <div className="p-3 border-b border-neutral-200 flex items-center justify-between gap-2">
        <input
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => { setPage(1); setQuery(e.target.value) }}
          className="w-full md:w-64 px-3 py-2 rounded-md border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary-700"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-neutral-600">
              {columns.map((c) => (
                <th key={String(c.key)} className="px-3 py-2 border-b border-neutral-200 font-medium">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((row, i) => (
              <tr key={i} className="hover:bg-neutral-50">
                {columns.map((c) => (
                  <td key={String(c.key)} className="px-3 py-2 border-b border-neutral-100">
                    {c.render ? c.render(row) : (c.key === 'actions' ? row['actions'] : String(row[c.key as keyof T] ?? ''))}
                  </td>
                ))}
              </tr>
            ))}
            {pageData.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-neutral-500">Aucune donnée</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="p-3 flex items-center justify-end gap-2">
        <button disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1 rounded-md border border-neutral-200 disabled:opacity-50 hover-pop press">Précédent</button>
        <div className="text-neutral-600">{page} / {totalPages}</div>
        <button disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="px-3 py-1 rounded-md border border-neutral-200 disabled:opacity-50 hover-pop press">Suivant</button>
      </div>
    </div>
  )
}
