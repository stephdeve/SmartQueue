/**
 * DataTable
 * Tableau générique piloté par colonnes.
 * - columns: définition d'entêtes + fonction render optionnelle
 * - data: tableau d'objets à afficher
 */
import React from 'react'

type Column<T> = {
  key: keyof T | string
  header: string
  render?: (row: T) => React.ReactNode
}

export default function DataTable<T extends { id?: number }>({ columns, data }: { columns: Column<T>[]; data: T[] }) {
  return (
    <div className="overflow-auto rounded-md border bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((c) => (
              <th key={String(c.key)} className="px-3 py-2 text-left text-xs font-semibold text-gray-600">{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 text-sm">
          {data.map((row, i) => (
            <tr key={(row.id ?? i).toString()} className="hover:bg-gray-50">
              {columns.map((c) => (
                <td key={String(c.key)} className="px-3 py-2">{c.render ? c.render(row) : String((row as any)[c.key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
