import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'

type DialogProps = {
  open: boolean
  onClose: () => void
  children: ReactNode
  ariaLabel?: string
  ariaLabelledBy?: string
}

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function Dialog({
  open,
  onClose,
  children,
  ariaLabel = 'Dialog',
  ariaLabelledBy,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const fallbackLabelId = useId()

  useEffect(() => {
    if (!open) {
      return
    }

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null

    const dialog = dialogRef.current
    const firstFocusable = dialog?.querySelector<HTMLElement>(focusableSelector)
    window.setTimeout(() => {
      ;(firstFocusable ?? dialog)?.focus()
    }, 0)

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab' || !dialog) {
        return
      }

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
      if (focusable.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previousFocusRef.current?.focus()
    }
  }, [open, onClose])

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
        tabIndex={-1}
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy ?? fallbackLabelId}
        tabIndex={-1}
        className="relative w-full max-w-md rounded-xl bg-white shadow-xl"
      >
        {!ariaLabelledBy ? (
          <span id={fallbackLabelId} className="sr-only">
            {ariaLabel}
          </span>
        ) : null}
        {children}
      </div>
    </div>
  )
}
