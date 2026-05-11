type DomainIconProps = {
  domain: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

const PALETTES = [
  { background: '#dbeafe', color: '#1d4ed8' },
  { background: '#dcfce7', color: '#15803d' },
  { background: '#fef3c7', color: '#b45309' },
  { background: '#fee2e2', color: '#b91c1c' },
  { background: '#e0e7ff', color: '#4338ca' },
  { background: '#fce7f3', color: '#be185d' },
]

const SIZE_CLASSES: Record<NonNullable<DomainIconProps['size']>, string> = {
  xs: 'h-4 w-4 text-[9px]',
  sm: 'h-5 w-5 text-[10px]',
  md: 'h-6 w-6 text-xs',
  lg: 'h-8 w-8 text-sm',
}

function hashDomain(domain: string): number {
  let hash = 0
  for (let index = 0; index < domain.length; index += 1) {
    hash = (hash * 31 + domain.charCodeAt(index)) >>> 0
  }
  return hash
}

function getDomainInitial(domain: string): string {
  const normalized = domain.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '')
  return normalized.match(/[a-z0-9]/i)?.[0]?.toUpperCase() ?? '#'
}

export function DomainIcon({ domain, size = 'sm', className = '' }: DomainIconProps) {
  const palette = PALETTES[hashDomain(domain) % PALETTES.length]

  return (
    <span
      aria-hidden="true"
      className={[
        'inline-flex shrink-0 items-center justify-center rounded font-bold leading-none',
        SIZE_CLASSES[size],
        className,
      ].join(' ')}
      style={palette}
    >
      {getDomainInitial(domain)}
    </span>
  )
}
