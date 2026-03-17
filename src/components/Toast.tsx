import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  type LucideIcon,
} from 'lucide-react'

type ToastProps = {
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
  action?: {
    label: string
    onClick: () => void
  }
}

const toastStyles: Record<
  ToastProps['type'],
  { icon: LucideIcon; classes: string }
> = {
  success: {
    icon: CheckCircle2,
    classes: 'border-green-200 bg-green-50 text-green-800',
  },
  error: {
    icon: AlertCircle,
    classes: 'border-red-200 bg-red-50 text-red-800',
  },
  info: {
    icon: Info,
    classes: 'border-blue-200 bg-blue-50 text-blue-800',
  },
  warning: {
    icon: AlertTriangle,
    classes: 'border-amber-200 bg-amber-50 text-amber-800',
  },
}

export function Toast({ type, message, action }: ToastProps) {
  const { icon: Icon, classes } = toastStyles[type]

  return (
    <div
      className={[
        'flex items-center gap-3 rounded-xl border px-4 py-3 shadow-sm',
        classes,
      ].join(' ')}
      role="status"
    >
      <Icon className="size-5 shrink-0" />
      <p className="min-w-0 flex-1 text-sm font-medium">{message}</p>
      {action ? (
        <button
          type="button"
          className="shrink-0 text-sm font-semibold underline underline-offset-4 transition-opacity duration-200 hover:opacity-80"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      ) : null}
    </div>
  )
}
