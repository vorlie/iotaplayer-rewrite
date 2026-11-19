import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy, FileAudio, FolderOpen, X } from 'lucide-react'
import { classifyAudioQuality, formatFileSize } from '../../electron/audioQuality'
import { useFormatDuration } from '../hooks/useLibrary'
import { formatDate, formatNumber } from '../i18n/format'
import type { Track } from '../types/electron'
import { QualityBadge } from './QualityBadge'

interface FileInspectorModalProps {
  track: Track
  onClose: () => void
}

export function FileInspectorModal({ track, onClose }: FileInspectorModalProps) {
  const { t, i18n } = useTranslation(['library', 'common'])
  const fmt = useFormatDuration()
  const [copied, setCopied] = useState(false)
  const quality = classifyAudioQuality(track)
  const locale = i18n.resolvedLanguage

  const channelsLabel =
    track.channels == null
      ? '—'
      : track.channels === 1
        ? t('inspector.channelsMono')
        : track.channels === 2
          ? t('inspector.channelsStereo')
          : t('inspector.channelsCount', { count: track.channels })

  const trackNumberLabel =
    track.track_number != null
      ? track.track_total != null
        ? `${track.track_number} / ${track.track_total}`
        : String(track.track_number)
      : '—'

  const discNumberLabel =
    track.disc_number != null
      ? track.disc_total != null
        ? `${track.disc_number} / ${track.disc_total}`
        : String(track.disc_number)
      : '—'

  async function handleCopyPath() {
    try {
      await navigator.clipboard.writeText(track.path)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Ignore clipboard errors
    }
  }

  function handleRevealInFolder() {
    if (typeof window !== 'undefined' && 'library' in window) {
      void window.library.revealFile(track.path)
    }
  }

  const technicalItems: Array<[string, string]> = [
    [t('inspector.fields.qualityTier'), t(`quality.tiers.${quality.tier}`)],
    [t('inspector.fields.codec'), track.codec ?? quality.codecLabel],
    [t('inspector.fields.container'), track.format ?? '—'],
    [
      t('inspector.fields.bitrate'),
      track.bitrate != null && track.bitrate > 0
        ? `${formatNumber(Math.round(track.bitrate), undefined, locale)} kbps`
        : '—',
    ],
    [
      t('inspector.fields.sampleRate'),
      track.sample_rate != null && track.sample_rate > 0
        ? `${formatNumber(track.sample_rate, undefined, locale)} Hz`
        : '—',
    ],
    [
      t('inspector.fields.bitDepth'),
      track.bits_per_sample != null && track.bits_per_sample > 0
        ? `${track.bits_per_sample}-bit`
        : '—',
    ],
    [t('inspector.fields.channels'), channelsLabel],
    [t('inspector.fields.duration'), fmt(track.duration)],
    [t('inspector.fields.fileSize'), formatFileSize(track.file_size)],
  ]

  const metadataItems: Array<[string, string]> = [
    [t('inspector.fields.artist'), track.artist ?? t('common:fallbacks.unknownArtist')],
    [t('inspector.fields.albumArtist'), track.album_artist ?? '—'],
    [t('inspector.fields.album'), track.album ?? t('common:fallbacks.unknownAlbum')],
    [t('inspector.fields.trackNumber'), trackNumberLabel],
    [t('inspector.fields.discNumber'), discNumberLabel],
    [t('inspector.fields.year'), track.year != null ? String(track.year) : '—'],
    [t('inspector.fields.genre'), track.genre ?? '—'],
    [
      t('inspector.fields.modifiedAt'),
      track.modified_time ? formatDate(track.modified_time, { dateStyle: 'medium', timeStyle: 'short' }, locale) : '—',
    ],
    [
      t('inspector.fields.addedAt'),
      track.added_at ? formatDate(track.added_at, { dateStyle: 'medium', timeStyle: 'short' }, locale) : '—',
    ],
  ]

  return (
    <div className="playlist-modal-backdrop" onClick={onClose}>
      <div
        className="inspector-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t('inspector.title')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="inspector-modal__header">
          <div className="inspector-modal__title-wrap">
            <div className="inspector-modal__eyebrow">
              <FileAudio size={13} />
              <span>{t('inspector.title')}</span>
            </div>
            <h2 className="inspector-modal__title">{track.title}</h2>
            <div className="inspector-modal__subtitle">
              <span>{track.artist ?? track.album_artist ?? t('common:fallbacks.unknownArtist')}</span>
              {track.album && (
                <>
                  <span>·</span>
                  <span>{track.album}</span>
                </>
              )}
            </div>
          </div>

          <div className="inspector-modal__header-actions">
            <QualityBadge track={track} compact={false} />
            <button
              type="button"
              className="player-btn"
              title={t('common:actions.close')}
              onClick={onClose}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="inspector-modal__section">
          <div className="inspector-modal__section-title">{t('inspector.sections.audio')}</div>
          <div className="inspector-grid">
            {technicalItems.map(([label, value]) => (
              <div key={label} className="inspector-item">
                <span className="inspector-item__label">{label}</span>
                <span className="inspector-item__value">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="inspector-modal__section">
          <div className="inspector-modal__section-title">{t('inspector.sections.metadata')}</div>
          <div className="inspector-grid">
            {metadataItems.map(([label, value]) => (
              <div key={label} className="inspector-item">
                <span className="inspector-item__label">{label}</span>
                <span className="inspector-item__value">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="inspector-modal__section">
          <div className="inspector-modal__section-title">{t('inspector.sections.location')}</div>
          <div className="inspector-path-box">
            <code className="inspector-path-box__text">{track.path}</code>
            <div className="inspector-path-box__actions">
              <button
                type="button"
                className="secondary-btn inspector-action-btn"
                onClick={() => void handleCopyPath()}
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                <span>{copied ? t('inspector.copied') : t('inspector.copyPath')}</span>
              </button>
              <button
                type="button"
                className="secondary-btn inspector-action-btn"
                onClick={handleRevealInFolder}
              >
                <FolderOpen size={13} />
                <span>{t('inspector.revealInFolder')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
