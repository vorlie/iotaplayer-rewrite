import type { CSSProperties } from 'react'
import '../styles/lyric-gap.css'

export interface LyricGapIndicatorProps {
  index: number
  isActive: boolean
  timestamp?: number
  onSeek?: (seconds: number) => void
  formattedTimestamp?: string
  variant?: 'fullscreen' | 'normal'
  className?: string
  style?: CSSProperties
}

export function LyricGapIndicator({
  index,
  isActive,
  timestamp,
  onSeek,
  formattedTimestamp,
  variant = 'normal',
  className = '',
  style,
}: LyricGapIndicatorProps) {
  const isClickable = timestamp != null && onSeek != null

  return (
    <button
      type="button"
      data-lyric-index={index}
      className={`lyric-gap-indicator lyric-gap-indicator--${variant} ${isActive ? 'is-active' : ''} ${isClickable ? 'is-clickable' : ''} ${className}`}
      disabled={!isClickable}
      onClick={() => {
        if (timestamp != null && onSeek) {
          onSeek(timestamp)
        }
      }}
      title={isClickable ? `Seek to gap at ${formattedTimestamp ?? timestamp}` : undefined}
      aria-label={timestamp != null ? `Instrumental gap at ${formattedTimestamp ?? timestamp}` : 'Instrumental gap'}
      style={style}
    >
      <span className="lyric-gap-dots" aria-hidden="true">
        <span className="lyric-gap-dot lyric-gap-dot--1" />
        <span className="lyric-gap-dot lyric-gap-dot--2" />
        <span className="lyric-gap-dot lyric-gap-dot--3" />
      </span>
    </button>
  )
}
