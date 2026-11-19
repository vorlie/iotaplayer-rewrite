import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart3, Disc3, HardDrive, Music2, RefreshCw } from 'lucide-react'
import { formatFileSize } from '../../electron/audioQuality'
import { useFormatDuration } from '../hooks/useLibrary'
import { formatNumber } from '../i18n/format'
import type { FormatStatBucket, LibraryFormatStats } from '../types/electron'
import '../styles/library.css'

function DistributionCard({
  title,
  items,
  totalTracks,
  locale,
}: {
  title: string
  items: FormatStatBucket[]
  totalTracks: number
  locale?: string
}) {
  const { t } = useTranslation('library')
  if (items.length === 0) return null

  return (
    <section className="stats-panel">
      <h2 className="stats-panel__title">{title}</h2>
      <div className="stats-bars">
        {items.map((item) => {
          const pct = totalTracks > 0 ? Math.round((item.count / totalTracks) * 100) : 0
          return (
            <div key={item.label} className="stats-bar-row">
              <div className="stats-bar-row__meta">
                <span className="stats-bar-row__label">{item.label}</span>
                <span className="stats-bar-row__value">
                  {t('counts.track', { count: item.count })} ({pct}%) · {formatFileSize(item.total_size)}
                </span>
              </div>
              <div className="stats-bar-track">
                <div
                  className="stats-bar-fill"
                  style={{ width: `${Math.max(pct, item.count > 0 ? 2 : 0)}%` }}
                  aria-label={`${item.label}: ${formatNumber(item.count, undefined, locale)}`}
                />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function LibraryStatsView() {
  const { t, i18n } = useTranslation(['library', 'common'])
  const fmt = useFormatDuration()
  const [stats, setStats] = useState<LibraryFormatStats | null>(null)
  const [loading, setLoading] = useState(() => typeof window !== 'undefined' && 'library' in window)
  const locale = i18n.resolvedLanguage

  const loadFormatStats = async () => {
    if (typeof window === 'undefined' || !('library' in window)) return
    setLoading(true)
    try {
      const data = await window.library.formatStats()
      setStats(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    if (typeof window !== 'undefined' && 'library' in window) {
      window.library
        .formatStats()
        .then((data) => {
          if (!cancelled) {
            setStats(data)
            setLoading(false)
          }
        })
        .catch(() => {
          if (!cancelled) setLoading(false)
        })
    }
    return () => {
      cancelled = true
    }
  }, [])

  if (loading && !stats) {
    return (
      <div className="page">
        <div className="loading-state">{t('statsView.loading')}</div>
      </div>
    )
  }

  if (!stats || stats.track_count === 0) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">{t('statsView.title')}</h1>
          <p className="page-subtitle">{t('statsView.subtitle')}</p>
        </div>
        <div className="page-body">
          <div className="empty-state">
            <div className="empty-state-title">{t('statsView.emptyTitle')}</div>
            <div className="empty-state-body">{t('statsView.emptyBody')}</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="stats-header-row">
          <div>
            <h1 className="page-title">{t('statsView.title')}</h1>
            <p className="page-subtitle">{t('statsView.subtitle')}</p>
          </div>

          <button
            type="button"
            className="secondary-btn stats-refresh-btn"
            onClick={() => void loadFormatStats()}
            disabled={loading}
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            <span>{t('statsView.refresh')}</span>
          </button>
        </div>
      </div>

      <div className="page-body stats-page-body">
        <div className="stats-kpi-grid">
          <div className="stats-kpi-card">
            <div className="stats-kpi-card__label">
              <Music2 size={13} />
              <span>{t('statsView.kpis.tracks')}</span>
            </div>
            <div className="stats-kpi-card__value">{formatNumber(stats.track_count, undefined, locale)}</div>
          </div>

          <div className="stats-kpi-card">
            <div className="stats-kpi-card__label">
              <Disc3 size={13} />
              <span>{t('statsView.kpis.albums')}</span>
            </div>
            <div className="stats-kpi-card__value">{formatNumber(stats.album_count, undefined, locale)}</div>
          </div>

          <div className="stats-kpi-card">
            <div className="stats-kpi-card__label">
              <BarChart3 size={13} />
              <span>{t('statsView.kpis.artists')}</span>
            </div>
            <div className="stats-kpi-card__value">{formatNumber(stats.artist_count, undefined, locale)}</div>
          </div>

          <div className="stats-kpi-card">
            <div className="stats-kpi-card__label">
              <span>{t('statsView.kpis.totalDuration')}</span>
            </div>
            <div className="stats-kpi-card__value">{fmt(stats.total_duration)}</div>
          </div>

          <div className="stats-kpi-card">
            <div className="stats-kpi-card__label">
              <HardDrive size={13} />
              <span>{t('statsView.kpis.totalStorage')}</span>
            </div>
            <div className="stats-kpi-card__value">{formatFileSize(stats.total_file_size)}</div>
          </div>
        </div>

        {/* Quality Tier Stacked Breakdown */}
        <section className="stats-panel">
          <h2 className="stats-panel__title">{t('statsView.sections.qualityTiers')}</h2>
          <div className="stats-stacked-bar">
            {stats.quality_tiers.map((item) => {
              const pct = stats.track_count > 0 ? (item.count / stats.track_count) * 100 : 0
              return (
                <div
                  key={item.tier}
                  className={`stats-stacked-bar__seg stats-stacked-bar__seg--${item.tier}`}
                  style={{ width: `${pct}%` }}
                  title={`${t(`quality.tiers.${item.tier}`)}: ${formatNumber(item.count, undefined, locale)} (${Math.round(pct)}%)`}
                />
              )
            })}
          </div>
          <div className="stats-tier-legend">
            {stats.quality_tiers.map((item) => {
              const pct = stats.track_count > 0 ? Math.round((item.count / stats.track_count) * 100) : 0
              return (
                <div key={item.tier} className="stats-tier-legend__item">
                  <span className={`stats-tier-dot stats-tier-dot--${item.tier}`} />
                  <span className="stats-tier-legend__name">{t(`quality.tiers.${item.tier}`)}</span>
                  <span className="stats-tier-legend__meta">
                    {t('counts.track', { count: item.count })} ({pct}%) · {formatFileSize(item.total_size)}
                  </span>
                </div>
              )
            })}
          </div>
        </section>

        <div className="stats-grid-2">
          <DistributionCard
            title={t('statsView.sections.codecs')}
            items={stats.codecs}
            totalTracks={stats.track_count}
            locale={locale}
          />
          <DistributionCard
            title={t('statsView.sections.sampleRates')}
            items={stats.sample_rates}
            totalTracks={stats.track_count}
            locale={locale}
          />
          <DistributionCard
            title={t('statsView.sections.bitrates')}
            items={stats.bitrates}
            totalTracks={stats.track_count}
            locale={locale}
          />
          <DistributionCard
            title={t('statsView.sections.genres')}
            items={stats.genres}
            totalTracks={stats.track_count}
            locale={locale}
          />
        </div>
      </div>
    </div>
  )
}
