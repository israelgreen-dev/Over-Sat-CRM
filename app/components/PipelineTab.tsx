'use client'

import { useState } from 'react'
import { type Opportunity, Modal, AddOpportunityModal } from './OpportunitiesTable'

const STAGE_COLORS: Record<string, string> = {
  Discovery:     'bg-blue-100 text-blue-700',
  Proposal:    'bg-yellow-100 text-yellow-700',
  Negotiation: 'bg-orange-100 text-orange-700',
  Win:         'bg-green-100 text-green-700',
  Loss:        'bg-red-100 text-red-700',
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(n)
}

const HEADERS = [
  'Account', 'Manager', 'Product', 'Value',
  'Probability', 'Stage', 'Close Date', 'Status', 'Next Action',
]

export default function PipelineTab({
  opportunities,
  addFormOpen = false,
  onAddFormOpenChange,
  products,
  managers,
  defaultOwner = '',
  onOppUpdated,
  onOppAdded,
}: {
  opportunities: Opportunity[]
  addFormOpen?: boolean
  onAddFormOpenChange?: (v: boolean) => void
  products?: string[]
  managers?: string[]
  defaultOwner?: string
  onOppUpdated?: (updated: Opportunity) => void
  onOppAdded?: (newOpp: Opportunity) => void
}) {
  const [rows, setRows]         = useState<Opportunity[]>(opportunities)
  const [selected, setSelected] = useState<Opportunity | null>(null)

  function handleSaved(updated: Opportunity) {
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
    setSelected(updated)
    onOppUpdated?.(updated)
  }

  function handleAdded(newOpp: Opportunity) {
    setRows((prev) => [newOpp, ...prev])
    onAddFormOpenChange?.(false)
    onOppAdded?.(newOpp)
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {HEADERS.map((h) => (
                <th
                  key={h}
                  className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={HEADERS.length} className="px-4 py-10 text-center text-gray-400">
                  No opportunities found.
                </td>
              </tr>
            ) : (
              rows.map((opp) => (
                <tr
                  key={opp.id}
                  onClick={() => setSelected(opp)}
                  className="cursor-pointer transition-colors hover:bg-gray-50"
                >
                  {/* Account */}
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">
                    {(opp.customer_name as string) ?? '—'}
                  </td>
                  {/* Manager */}
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                    {(opp.owner as string) ?? '—'}
                  </td>
                  {/* Product */}
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                    {(opp.product as string) ?? '—'}
                  </td>
                  {/* Value */}
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-gray-900">
                    {opp.value != null ? fmtCurrency(opp.value) : '—'}
                  </td>
                  {/* Probability */}
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                    {(opp as any).probability != null ? `${(opp as any).probability}%` : '—'}
                  </td>
                  {/* Stage */}
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        STAGE_COLORS[opp.stage] ?? 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {opp.stage ?? '—'}
                    </span>
                  </td>
                  {/* Close Date */}
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                    {(opp as any).close_date ?? '—'}
                  </td>
                  {/* Status */}
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                    {(opp as any).status ?? '—'}
                  </td>
                  {/* Next Action */}
                  <td className="max-w-[180px] truncate px-4 py-3 text-gray-600">
                    {(opp as any).next_action ?? '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <Modal
          opportunity={selected}
          onClose={() => setSelected(null)}
          onSaved={handleSaved}
          products={products}
          managers={managers}
        />
      )}

      {addFormOpen && (
        <AddOpportunityModal
          products={products}
          managers={managers}
          defaultOwner={defaultOwner}
          onClose={() => onAddFormOpenChange?.(false)}
          onAdded={handleAdded}
        />
      )}
    </>
  )
}
