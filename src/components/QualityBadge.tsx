import { classifyAudioQuality, type AudioQualityInput } from '../../electron/audioQuality'

interface QualityBadgeProps {
  track: AudioQualityInput
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  compact?: boolean
}

export function QualityBadge({ track, onClick, compact = true }: QualityBadgeProps) {
  const info = classifyAudioQuality(track)
  const tooltipParts = [
    info.codecLabel,
    info.bitDepthLabel,
    info.sampleRateLabel,
    info.bitrateLabel,
  ].filter(Boolean)

  const tooltip = tooltipParts.join(' · ')
  const label = compact ? info.badgeLabel : info.shortLabel

  if (onClick) {
    return (
      <button
        type="button"
        className={`quality-badge quality-badge--${info.tier} quality-badge--interactive`}
        title={tooltip}
        onClick={(e) => {
          e.stopPropagation()
          onClick(e)
        }}
      >
        {label}
      </button>
    )
  }

  return (
    <span className={`quality-badge quality-badge--${info.tier}`} title={tooltip}>
      {label}
    </span>
  )
}
