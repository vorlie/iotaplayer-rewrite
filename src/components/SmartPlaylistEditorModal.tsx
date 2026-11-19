import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Sparkles, Trash2, X } from 'lucide-react'
import type {
  SmartPlaylist,
  SmartPlaylistField,
  SmartPlaylistInput,
  SmartPlaylistMatchMode,
  SmartPlaylistOperator,
  SmartPlaylistRule,
  SmartPlaylistSortBy,
  SmartPlaylistSortOrder,
} from '../types/electron'

interface SmartPlaylistEditorModalProps {
  initial?: SmartPlaylist | null
  onSave: (input: SmartPlaylistInput) => Promise<void>
  onClose: () => void
}

const FIELD_OPERATORS: Record<SmartPlaylistField, SmartPlaylistOperator[]> = {
  genre: ['contains', 'not_contains', 'equals', 'not_equals'],
  artist: ['contains', 'not_contains', 'equals', 'not_equals'],
  album: ['contains', 'not_contains', 'equals', 'not_equals'],
  title: ['contains', 'not_contains', 'equals', 'not_equals'],
  codec: ['contains', 'not_contains', 'equals', 'not_equals'],
  year: ['equals', 'not_equals', 'gt', 'lt', 'gte', 'lte'],
  play_count: ['equals', 'gt', 'lt', 'gte', 'lte'],
  duration: ['gt', 'lt', 'gte', 'lte'],
  bitrate: ['gt', 'lt', 'gte', 'lte', 'equals'],
  sample_rate: ['equals', 'gt', 'lt', 'gte', 'lte'],
  added_at: ['in_last_days'],
  last_played_at: ['in_last_days'],
  is_lossless: ['is_true', 'is_false'],
  is_favorite: ['is_true', 'is_false'],
}

const NUMERIC_FIELDS = new Set<SmartPlaylistField>([
  'year',
  'play_count',
  'duration',
  'bitrate',
  'sample_rate',
  'added_at',
  'last_played_at',
])

const BOOLEAN_FIELDS = new Set<SmartPlaylistField>(['is_lossless', 'is_favorite'])

const ALL_FIELDS: SmartPlaylistField[] = [
  'genre',
  'artist',
  'album',
  'title',
  'year',
  'codec',
  'is_lossless',
  'is_favorite',
  'play_count',
  'last_played_at',
  'added_at',
  'duration',
  'bitrate',
  'sample_rate',
]

const SORT_FIELDS: SmartPlaylistSortBy[] = [
  'added_at',
  'play_count',
  'last_played_at',
  'title',
  'artist',
  'album',
  'year',
  'duration',
  'bitrate',
  'random',
]

function defaultValueForField(field: SmartPlaylistField): string | number | boolean {
  if (BOOLEAN_FIELDS.has(field)) return true
  if (field === 'added_at' || field === 'last_played_at') return 30
  if (field === 'year') return 2020
  if (field === 'play_count') return 0
  if (field === 'bitrate') return 320
  if (field === 'sample_rate') return 44100
  if (field === 'duration') return 180
  return ''
}

export function SmartPlaylistEditorModal({
  initial,
  onSave,
  onClose,
}: SmartPlaylistEditorModalProps) {
  const { t } = useTranslation(['playlists', 'library', 'common'])
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [matchMode, setMatchMode] = useState<SmartPlaylistMatchMode>(initial?.matchMode ?? 'all')
  const [rules, setRules] = useState<SmartPlaylistRule[]>(
    initial?.rules && initial.rules.length > 0
      ? initial.rules
      : [{ field: 'genre', operator: 'contains', value: '' }],
  )
  const [sortBy, setSortBy] = useState<SmartPlaylistSortBy>(initial?.sortBy ?? 'added_at')
  const [sortOrder, setSortOrder] = useState<SmartPlaylistSortOrder>(initial?.sortOrder ?? 'desc')
  const [limitText, setLimitText] = useState(initial?.limit != null ? String(initial.limit) : '')
  const [previewCount, setPreviewCount] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const parsedLimit = limitText.trim() ? Number(limitText) : null
  const validLimit = parsedLimit != null && Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.floor(parsedLimit)
    : null

  useEffect(() => {
    let cancelled = false
    if (typeof window === 'undefined' || !('library' in window)) return

    const timer = setTimeout(() => {
      void window.library
        .previewSmartPlaylist({
          name: name.trim() || 'Preview',
          matchMode,
          rules,
          sortBy,
          sortOrder,
          limit: validLimit,
        })
        .then((tracks) => {
          if (!cancelled) setPreviewCount(tracks.length)
        })
        .catch(() => {
          if (!cancelled) setPreviewCount(null)
        })
    }, 150)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [name, matchMode, rules, sortBy, sortOrder, validLimit])

  function updateRule(index: number, patch: Partial<SmartPlaylistRule>) {
    setRules((prev) =>
      prev.map((rule, i) => {
        if (i !== index) return rule
        const nextField = patch.field ?? rule.field
        const allowedOps = FIELD_OPERATORS[nextField]
        const nextOperator =
          patch.field && !allowedOps.includes(patch.operator ?? rule.operator)
            ? allowedOps[0]
            : patch.operator ?? rule.operator
        const nextValue =
          patch.field && patch.field !== rule.field
            ? defaultValueForField(nextField)
            : patch.value !== undefined
              ? patch.value
              : rule.value
        return { field: nextField, operator: nextOperator, value: nextValue }
      }),
    )
  }

  function addRule() {
    setRules((prev) => [...prev, { field: 'artist', operator: 'contains', value: '' }])
  }

  function removeRule(index: number) {
    setRules((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    setSaving(true)
    try {
      await onSave({
        name: trimmed,
        description: description.trim(),
        matchMode,
        rules,
        sortBy,
        sortOrder,
        limit: validLimit,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="playlist-modal-backdrop" onClick={onClose}>
      <div
        className="smart-playlist-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="playlist-modal__header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={16} color="var(--color-accent)" />
            <h2 className="playlist-modal__title">
              {initial ? t('smart.editTitle') : t('smart.newTitle')}
            </h2>
          </div>
          <button
            type="button"
            className="player-btn"
            title={t('common:actions.close')}
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>

        <form className="playlist-modal__form" onSubmit={(e) => void handleSubmit(e)}>
          <div className="smart-modal-row-2">
            <label className="playlist-field">
              <span>{t('editor.name')}</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('smart.namePlaceholder')}
                autoFocus
                required
              />
            </label>

            <label className="playlist-field">
              <span>{t('smart.matchModeLabel')}</span>
              <select
                value={matchMode}
                onChange={(e) => setMatchMode(e.target.value as SmartPlaylistMatchMode)}
                className="smart-select"
              >
                <option value="all">{t('smart.matchAll')}</option>
                <option value="any">{t('smart.matchAny')}</option>
              </select>
            </label>
          </div>

          <label className="playlist-field">
            <span>{t('editor.description')}</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('editor.descriptionPlaceholder')}
            />
          </label>

          <div className="smart-rules-section">
            <div className="smart-rules-header">
              <span className="playlist-field__label">{t('smart.rulesLabel')}</span>
              <button type="button" className="secondary-btn smart-add-rule-btn" onClick={addRule}>
                <Plus size={12} />
                <span>{t('smart.addRule')}</span>
              </button>
            </div>

            <div className="smart-rules-list">
              {rules.map((rule, idx) => {
                const ops = FIELD_OPERATORS[rule.field]
                const isBoolean = BOOLEAN_FIELDS.has(rule.field)
                const isNumeric = NUMERIC_FIELDS.has(rule.field)

                return (
                  <div key={idx} className="smart-rule-row">
                    <select
                      value={rule.field}
                      onChange={(e) => updateRule(idx, { field: e.target.value as SmartPlaylistField })}
                      className="smart-select"
                    >
                      {ALL_FIELDS.map((field) => (
                        <option key={field} value={field}>
                          {t(`smart.fields.${field}`)}
                        </option>
                      ))}
                    </select>

                    <select
                      value={rule.operator}
                      onChange={(e) => updateRule(idx, { operator: e.target.value as SmartPlaylistOperator })}
                      className="smart-select"
                    >
                      {ops.map((op) => (
                        <option key={op} value={op}>
                          {t(`smart.operators.${op}`)}
                        </option>
                      ))}
                    </select>

                    {!isBoolean ? (
                      <input
                        type={isNumeric ? 'number' : 'text'}
                        className="smart-rule-input"
                        value={rule.value == null ? '' : String(rule.value)}
                        onChange={(e) => updateRule(idx, { value: e.target.value })}
                        placeholder={
                          rule.operator === 'in_last_days'
                            ? t('smart.daysPlaceholder')
                            : t('smart.valuePlaceholder')
                        }
                      />
                    ) : (
                      <div className="smart-rule-bool-spacer" />
                    )}

                    <button
                      type="button"
                      className="queue-icon-btn queue-icon-btn--danger"
                      onClick={() => removeRule(idx)}
                      disabled={rules.length <= 1}
                      title={t('smart.removeRule')}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="smart-modal-row-3">
            <label className="playlist-field">
              <span>{t('smart.sortBy')}</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SmartPlaylistSortBy)}
                className="smart-select"
              >
                {SORT_FIELDS.map((sf) => (
                  <option key={sf} value={sf}>
                    {sf === 'random' ? t('smart.sortRandom') : t(`smart.fields.${sf}`)}
                  </option>
                ))}
              </select>
            </label>

            <label className="playlist-field">
              <span>{t('smart.sortOrder')}</span>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SmartPlaylistSortOrder)}
                className="smart-select"
                disabled={sortBy === 'random'}
              >
                <option value="desc">{t('smart.orderDesc')}</option>
                <option value="asc">{t('smart.orderAsc')}</option>
              </select>
            </label>

            <label className="playlist-field">
              <span>{t('smart.limitLabel')}</span>
              <input
                type="number"
                min={1}
                max={5000}
                value={limitText}
                onChange={(e) => setLimitText(e.target.value)}
                placeholder={t('smart.limitPlaceholder')}
              />
            </label>
          </div>

          <div className="smart-modal-footer">
            <span className="smart-preview-badge">
              {previewCount != null
                ? t('smart.previewCount', { count: previewCount })
                : '…'}
            </span>

            <div className="playlist-editor-actions">
              <button
                type="submit"
                className="detail-play-btn playlist-toolbar-btn"
                disabled={!name.trim() || saving}
              >
                {saving ? t('common:actions.saving') : t('common:actions.save')}
              </button>
              <button
                type="button"
                className="secondary-btn playlist-toolbar-btn"
                onClick={onClose}
              >
                {t('common:actions.cancel')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
