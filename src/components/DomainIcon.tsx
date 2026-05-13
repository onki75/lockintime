import { useEffect, useState } from 'react'
import { getChromeFaviconUrl, isChromeFaviconKnown } from '../lib/favicon'

type DomainIconSize = 'xs' | 'sm' | 'md' | 'lg'

type DomainIconProps = {
  domain: string
  size?: DomainIconSize
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

const DIMENSION_CLASSES: Record<DomainIconSize, string> = {
  xs: 'h-4 w-4',
  sm: 'h-5 w-5',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
}

const TEXT_CLASSES: Record<DomainIconSize, string> = {
  xs: 'text-[9px]',
  sm: 'text-[10px]',
  md: 'text-xs',
  lg: 'text-sm',
}

const FAVICON_PIXEL_SIZE: Record<DomainIconSize, number> = {
  xs: 32,
  sm: 32,
  md: 32,
  lg: 64,
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

function LetterBadge({ domain, size, className }: Required<DomainIconProps>) {
  const palette = PALETTES[hashDomain(domain) % PALETTES.length]

  return (
    <span
      aria-hidden="true"
      className={[
        'inline-flex shrink-0 items-center justify-center rounded font-bold leading-none',
        DIMENSION_CLASSES[size],
        TEXT_CLASSES[size],
        className,
      ].join(' ')}
      style={palette}
    >
      {getDomainInitial(domain)}
    </span>
  )
}

export function DomainIcon({ domain, size = 'sm', className = '' }: DomainIconProps) {
  const [useLetterFallback, setUseLetterFallback] = useState(false)
  const pixelSize = FAVICON_PIXEL_SIZE[size]
  const faviconUrl = useLetterFallback ? null : getChromeFaviconUrl(domain, pixelSize)

  useEffect(() => {
    setUseLetterFallback(false)
    let cancelled = false

    isChromeFaviconKnown(domain, pixelSize).then((known) => {
      if (!cancelled && !known) {
        setUseLetterFallback(true)
      }
    })

    return () => {
      cancelled = true
    }
  }, [domain, pixelSize])

  if (!faviconUrl) {
    return <LetterBadge domain={domain} size={size} className={className} />
  }

  return (
    <img
      aria-hidden="true"
      src={faviconUrl}
      alt=""
      onError={() => setUseLetterFallback(true)}
      className={[
        'inline-block shrink-0 rounded object-cover',
        DIMENSION_CLASSES[size],
        className,
      ].join(' ')}
    />
  )
}
