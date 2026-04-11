// src/components/status-badge.tsx
import type { SeerrStatus } from '@/types'

const config: Record<SeerrStatus, { label: string; className: string }> = {
  available:     { label: '● Ready',       className: 'bg-green-100 text-green-700 border-green-200' },
  processing:    { label: '⏳ Downloading', className: 'bg-amber-100 text-amber-700 border-amber-300' },
  pending:       { label: '○ Queued',      className: 'bg-stone-100 text-stone-500 border-stone-200' },
  not_requested: { label: '○ Not Requested', className: 'bg-stone-100 text-stone-400 border-stone-200' },
  deleted:       { label: '✓ Deleted',     className: 'bg-stone-100 text-stone-400 border-stone-200' },
}

export function StatusBadge({ status }: { status: SeerrStatus }) {
  const { label, className } = config[status] ?? config.not_requested
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${className}`}>
      {label}
    </span>
  )
}
