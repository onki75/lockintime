type ToggleProps = {
  checked: boolean
  onChange: (checked: boolean) => void
  size?: 'sm' | 'md'
  disabled?: boolean
}

const toggleSizeClasses = {
  sm: {
    track: 'h-5 w-9',
    thumb: 'size-4',
    translate: 'translate-x-4',
  },
  md: {
    track: 'h-6 w-11',
    thumb: 'size-5',
    translate: 'translate-x-5',
  },
} as const

export function Toggle({ checked, onChange, size = 'md', disabled = false }: ToggleProps) {
  const classes = toggleSizeClasses[size]

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={[
        'relative inline-flex shrink-0 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        classes.track,
        checked ? 'bg-blue-600' : 'bg-gray-300',
      ].join(' ')}
      onClick={() => {
        if (disabled) return
        onChange(!checked)
      }}
    >
      <span
        className={[
          'inline-block rounded-full bg-white shadow-sm transition-all duration-200',
          classes.thumb,
          checked ? classes.translate : 'translate-x-0.5',
        ].join(' ')}
      />
    </button>
  )
}
