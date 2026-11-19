import type {
  SmartPlaylist,
  SmartPlaylistField,
  SmartPlaylistMatchMode,
  SmartPlaylistOperator,
  SmartPlaylistRule,
  SmartPlaylistSortBy,
  SmartPlaylistSortOrder,
} from './types'

export interface CompiledSmartPlaylistQuery {
  sql: string
  params: Array<string | number>
}

const VALID_FIELDS = new Set<SmartPlaylistField>([
  'title',
  'artist',
  'album',
  'genre',
  'year',
  'codec',
  'is_lossless',
  'play_count',
  'last_played_at',
  'added_at',
  'duration',
  'bitrate',
  'sample_rate',
  'is_favorite',
])

const VALID_OPERATORS = new Set<SmartPlaylistOperator>([
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'gt',
  'lt',
  'gte',
  'lte',
  'in_last_days',
  'is_true',
  'is_false',
])

const FIELD_SQL_MAP: Record<SmartPlaylistField, string> = {
  title: 't.title',
  artist: 'COALESCE(t.artist, t.album_artist, \'\')',
  album: 'COALESCE(t.album, \'\')',
  genre: 'COALESCE(t.genre, \'\')',
  year: 't.year',
  codec: 'COALESCE(t.codec, \'\')',
  is_lossless: 'COALESCE(t.is_lossless, 0)',
  play_count: 'COALESCE(t.play_count, 0)',
  last_played_at: 't.last_played_at',
  added_at: 'COALESCE(t.added_at, t.modified_time)',
  duration: 't.duration',
  bitrate: 't.bitrate',
  sample_rate: 't.sample_rate',
  is_favorite: 'CASE WHEN f.track_id IS NOT NULL THEN 1 ELSE 0 END',
}

const SORT_SQL_MAP: Record<SmartPlaylistSortBy, string> = {
  title: 'LOWER(t.title)',
  artist: 'LOWER(COALESCE(t.artist, t.album_artist, \'\'))',
  album: 'LOWER(COALESCE(t.album, \'\'))',
  year: 'COALESCE(t.year, 0)',
  duration: 't.duration',
  play_count: 'COALESCE(t.play_count, 0)',
  last_played_at: 'COALESCE(t.last_played_at, 0)',
  added_at: 'COALESCE(t.added_at, t.modified_time, 0)',
  bitrate: 'COALESCE(t.bitrate, 0)',
  random: 'RANDOM()',
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&')
}

export function normalizeSmartPlaylistRules(rules: unknown): SmartPlaylistRule[] {
  if (!Array.isArray(rules)) return []
  const normalized: SmartPlaylistRule[] = []

  for (const item of rules) {
    if (!item || typeof item !== 'object') continue
    const candidate = item as Partial<SmartPlaylistRule>
    if (!candidate.field || !VALID_FIELDS.has(candidate.field)) continue
    if (!candidate.operator || !VALID_OPERATORS.has(candidate.operator)) continue
    normalized.push({
      field: candidate.field,
      operator: candidate.operator,
      value: candidate.value ?? null,
    })
  }

  return normalized
}

export function compileSmartPlaylistQuery(
  options: {
    matchMode: SmartPlaylistMatchMode
    rules: SmartPlaylistRule[]
    sortBy: SmartPlaylistSortBy
    sortOrder: SmartPlaylistSortOrder
    limit: number | null
  },
  nowMs: number = Date.now(),
): CompiledSmartPlaylistQuery {
  const rules = normalizeSmartPlaylistRules(options.rules)
  const params: Array<string | number> = []
  const clauses: string[] = []

  for (const rule of rules) {
    const columnSql = FIELD_SQL_MAP[rule.field]
    if (!columnSql) continue

    if (rule.operator === 'is_true') {
      clauses.push(`${columnSql} = 1`)
      continue
    }

    if (rule.operator === 'is_false') {
      clauses.push(`${columnSql} = 0`)
      continue
    }

    if (rule.operator === 'in_last_days') {
      const days = Number(rule.value)
      if (!Number.isFinite(days) || days < 0) continue
      const cutoff = Math.floor(nowMs - days * 86_400_000)
      clauses.push(`${columnSql} IS NOT NULL AND ${columnSql} >= ?`)
      params.push(cutoff)
      continue
    }

    if (rule.operator === 'contains' || rule.operator === 'not_contains') {
      const text = String(rule.value ?? '').trim()
      if (!text) continue
      const pattern = `%${escapeLike(text)}%`
      clauses.push(
        rule.operator === 'contains'
          ? `${columnSql} LIKE ? ESCAPE '\\' COLLATE NOCASE`
          : `${columnSql} NOT LIKE ? ESCAPE '\\' COLLATE NOCASE`,
      )
      params.push(pattern)
      continue
    }

    if (rule.operator === 'equals' || rule.operator === 'not_equals') {
      if (rule.value === null || rule.value === undefined || rule.value === '') continue
      const isNumericField =
        rule.field === 'year' ||
        rule.field === 'play_count' ||
        rule.field === 'duration' ||
        rule.field === 'bitrate' ||
        rule.field === 'sample_rate' ||
        rule.field === 'is_lossless' ||
        rule.field === 'is_favorite'

      if (isNumericField) {
        const num = Number(rule.value)
        if (!Number.isFinite(num)) continue
        clauses.push(rule.operator === 'equals' ? `${columnSql} = ?` : `${columnSql} != ?`)
        params.push(num)
      } else {
        clauses.push(
          rule.operator === 'equals'
            ? `LOWER(${columnSql}) = LOWER(?)`
            : `LOWER(${columnSql}) != LOWER(?)`,
        )
        params.push(String(rule.value).trim())
      }
      continue
    }

    // Numeric comparisons: gt, lt, gte, lte
    const num = Number(rule.value)
    if (!Number.isFinite(num)) continue
    const opSql =
      rule.operator === 'gt'
        ? '>'
        : rule.operator === 'lt'
          ? '<'
          : rule.operator === 'gte'
            ? '>='
            : '<='
    clauses.push(`${columnSql} IS NOT NULL AND ${columnSql} ${opSql} ?`)
    params.push(num)
  }

  const joiner = options.matchMode === 'any' ? ' OR ' : ' AND '
  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(joiner)}` : ''

  const sortCol = SORT_SQL_MAP[options.sortBy] ?? SORT_SQL_MAP.added_at
  const sortDir = options.sortOrder === 'asc' ? 'ASC' : 'DESC'
  const orderSql = options.sortBy === 'random' ? 'ORDER BY RANDOM()' : `ORDER BY ${sortCol} ${sortDir}, LOWER(t.title) ASC`

  const safeLimit =
    options.limit != null && Number.isFinite(options.limit) && options.limit > 0
      ? Math.min(Math.floor(options.limit), 5000)
      : null
  const limitSql = safeLimit != null ? 'LIMIT ?' : ''
  if (safeLimit != null) {
    params.push(safeLimit)
  }

  const sql = `
    SELECT
      t.id, t.title, t.artist, t.album_artist, t.album, t.album_id, t.artist_id,
      t.track_number, t.track_total, t.disc_number, t.disc_total,
      t.year, t.genre, t.duration, t.bitrate, t.sample_rate,
      t.bits_per_sample, t.channels, t.is_lossless, t.codec, t.format,
      t.path, t.file_size, t.modified_time, t.added_at, t.play_count, t.last_played_at, t.artwork_id
    FROM tracks t
    LEFT JOIN favorites f ON f.track_id = t.id
    ${whereSql}
    ${orderSql}
    ${limitSql}
  `.trim()

  return { sql, params }
}

export function getDefaultSmartPlaylists(nowMs: number = Date.now()): SmartPlaylist[] {
  return [
    {
      id: 'smart-recently-added',
      name: 'Recently Added',
      description: 'Tracks added in the last 30 days',
      matchMode: 'all',
      rules: [{ field: 'added_at', operator: 'in_last_days', value: 30 }],
      sortBy: 'added_at',
      sortOrder: 'desc',
      limit: 100,
      isSystem: true,
      createdAt: nowMs,
      lastModified: nowMs,
    },
    {
      id: 'smart-most-played',
      name: 'Most Played',
      description: 'Your most frequently played tracks',
      matchMode: 'all',
      rules: [{ field: 'play_count', operator: 'gt', value: 0 }],
      sortBy: 'play_count',
      sortOrder: 'desc',
      limit: 50,
      isSystem: true,
      createdAt: nowMs,
      lastModified: nowMs,
    },
    {
      id: 'smart-never-played',
      name: 'Never Played',
      description: 'Tracks in your library with zero plays',
      matchMode: 'all',
      rules: [{ field: 'play_count', operator: 'equals', value: 0 }],
      sortBy: 'added_at',
      sortOrder: 'desc',
      limit: 100,
      isSystem: true,
      createdAt: nowMs,
      lastModified: nowMs,
    },
    {
      id: 'smart-lossless-favorites',
      name: 'Lossless Favorites',
      description: 'Starred tracks in lossless or hi-res quality',
      matchMode: 'all',
      rules: [
        { field: 'is_favorite', operator: 'is_true', value: true },
        { field: 'is_lossless', operator: 'is_true', value: true },
      ],
      sortBy: 'title',
      sortOrder: 'asc',
      limit: null,
      isSystem: true,
      createdAt: nowMs,
      lastModified: nowMs,
    },
  ]
}
