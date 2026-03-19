import React from 'react'

/**
 * Skeleton placeholder for KPI stat cards on the Dashboard.
 * Matches the 3-column grid layout to prevent layout shift during data fetch.
 */
export function SkeletonStatCard() {
  return (
    <div className="bg-neutral-900/50 border border-neutral-800 p-10 rounded-[3.5rem] animate-pulse">
      <div className="h-3 w-28 bg-neutral-800 rounded mb-6" />
      <div className="h-20 w-36 bg-neutral-800 rounded mb-10" />
      <div className="h-2 w-full bg-neutral-800 rounded" />
    </div>
  )
}

/**
 * Skeleton placeholder for report cards in the Centro de Informes grid.
 */
export function SkeletonReporteCard() {
  return (
    <div className="bg-neutral-900/40 border border-neutral-800 p-10 rounded-[3.5rem] animate-pulse">
      <div className="flex justify-between items-start mb-10">
        <div className="h-14 w-14 bg-neutral-800 rounded-2xl" />
        <div className="h-6 w-6 bg-neutral-800 rounded" />
      </div>
      <div className="h-9 w-52 bg-neutral-800 rounded mb-3" />
      <div className="h-3 w-36 bg-neutral-800 rounded mb-8" />
      <div className="grid grid-cols-2 gap-6 border-t border-neutral-800 pt-8 mb-10">
        <div className="h-9 w-16 bg-neutral-800 rounded" />
        <div className="h-9 w-16 bg-neutral-800 rounded" />
      </div>
      <div className="h-12 w-full bg-neutral-800 rounded-2xl" />
    </div>
  )
}

/**
 * Skeleton placeholder for a row in the Activity Stream table.
 */
export function SkeletonTableRow() {
  return (
    <tr className="border-b border-neutral-800/20">
      {[72, 48, 36, 36, 56].map((w, i) => (
        <td key={i} className="px-12 py-8">
          <div
            className="h-4 bg-neutral-800 rounded animate-pulse"
            style={{ width: `${w}%` }}
          />
        </td>
      ))}
    </tr>
  )
}

/**
 * Skeleton for the analytics terminal bar chart rows.
 */
export function SkeletonBarRow() {
  return (
    <div className="animate-pulse">
      <div className="flex justify-between mb-3">
        <div className="h-7 w-40 bg-neutral-800 rounded" />
        <div className="h-5 w-16 bg-neutral-800 rounded" />
      </div>
      <div className="h-2.5 w-full bg-neutral-800 rounded-full" />
    </div>
  )
}
