import type { ReactNode } from 'react'

type DialogProps = {
  open: boolean
  onClose: () => void
  children: ReactNode
}

export function Dialog({ open, onClose, children }: DialogProps) {
  return (
    <div
      inert={!open}
      className={[
        'fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200',
        open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
      ].join(' ')}
    >
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md rounded-xl bg-white shadow-xl"
      >
        {children}
      </div>
    </div>
  )
}
