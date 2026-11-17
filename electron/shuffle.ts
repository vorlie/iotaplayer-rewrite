export type ShuffleRepeatMode = 'off' | 'all' | 'one'

export type RandomFn = () => number

export interface ShuffleState {
  /** Shuffled permutation of queueEntryIds for the current cycle */
  order: string[]
  /** Index into `history` pointing to the currently active entry (-1 when empty) */
  cursor: number
  /** Index into `history` where the current shuffle cycle began */
  cycleStartIndex: number
  /** Chronological playback trail of queueEntryIds */
  history: string[]
}

let entrySequence = 0

export function createQueueEntryId(): string {
  entrySequence += 1
  return `qe-${entrySequence}`
}

export function createQueueEntryIds(count: number): string[] {
  const ids: string[] = []
  for (let i = 0; i < count; i++) {
    ids.push(createQueueEntryId())
  }
  return ids
}

export function createEmptyShuffleState(): ShuffleState {
  return {
    order: [],
    cursor: -1,
    cycleStartIndex: 0,
    history: [],
  }
}

export function fisherYatesShuffle<T>(
  items: readonly T[],
  rng: RandomFn = Math.random,
): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const raw = rng()
    const bounded = Number.isFinite(raw) ? Math.min(0.999999999999, Math.max(0, raw)) : 0
    const j = Math.floor(bounded * (i + 1))
    const temp = copy[i]
    copy[i] = copy[j]
    copy[j] = temp
  }
  return copy
}

export function initShuffleState(
  entryIds: readonly string[],
  currentEntryId: string | null,
  rng: RandomFn = Math.random,
): ShuffleState {
  if (entryIds.length === 0) {
    return createEmptyShuffleState()
  }

  if (currentEntryId && entryIds.includes(currentEntryId)) {
    const rest = entryIds.filter((id) => id !== currentEntryId)
    const shuffledRest = fisherYatesShuffle(rest, rng)
    return {
      order: [currentEntryId, ...shuffledRest],
      cursor: 0,
      cycleStartIndex: 0,
      history: [currentEntryId],
    }
  }

  return {
    order: fisherYatesShuffle(entryIds, rng),
    cursor: -1,
    cycleStartIndex: 0,
    history: [],
  }
}

export function advanceShuffleNext(
  state: ShuffleState,
  entryIds: readonly string[],
  repeatMode: ShuffleRepeatMode,
  rng: RandomFn = Math.random,
): { entryId: string | null; shuffleState: ShuffleState; ended: boolean } {
  if (entryIds.length === 0) {
    return {
      entryId: null,
      shuffleState: createEmptyShuffleState(),
      ended: true,
    }
  }

  // 1. Replay forward history if the user previously navigated backwards
  if (state.cursor + 1 < state.history.length) {
    const nextCursor = state.cursor + 1
    return {
      entryId: state.history[nextCursor],
      shuffleState: {
        ...state,
        cursor: nextCursor,
      },
      ended: false,
    }
  }

  // 2. Otherwise pick the next unplayed entry from the current cycle's deck
  const validEntries = new Set(entryIds)
  const playedInCycle = new Set(state.history.slice(state.cycleStartIndex))
  const nextUnplayed = state.order.find(
    (id) => validEntries.has(id) && !playedInCycle.has(id),
  )

  if (nextUnplayed) {
    const nextHistory = [...state.history, nextUnplayed]
    return {
      entryId: nextUnplayed,
      shuffleState: {
        ...state,
        history: nextHistory,
        cursor: nextHistory.length - 1,
      },
      ended: false,
    }
  }

  // 3. Current cycle is exhausted
  if (repeatMode === 'off') {
    return {
      entryId: null,
      shuffleState: state,
      ended: true,
    }
  }

  // Repeat All: start a fresh Fisher–Yates cycle without immediately repeating the ending entry
  const lastPlayedId =
    state.cursor >= 0 && state.cursor < state.history.length
      ? state.history[state.cursor]
      : null

  const newOrder = fisherYatesShuffle(entryIds, rng)
  if (newOrder.length >= 2 && lastPlayedId && newOrder[0] === lastPlayedId) {
    const raw = rng()
    const bounded = Number.isFinite(raw) ? Math.min(0.999999999999, Math.max(0, raw)) : 0
    const swapIndex = 1 + Math.floor(bounded * (newOrder.length - 1))
    const temp = newOrder[0]
    newOrder[0] = newOrder[swapIndex]
    newOrder[swapIndex] = temp
  }

  const firstId = newOrder[0]
  const nextCycleStartIndex = state.history.length
  const nextHistory = [...state.history, firstId]

  return {
    entryId: firstId,
    shuffleState: {
      order: newOrder,
      cursor: nextHistory.length - 1,
      cycleStartIndex: nextCycleStartIndex,
      history: nextHistory,
    },
    ended: false,
  }
}

export function stepShufflePrevious(
  state: ShuffleState,
): { entryId: string | null; shuffleState: ShuffleState } {
  if (state.cursor <= 0 || state.history.length === 0) {
    return {
      entryId: null,
      shuffleState: state,
    }
  }

  const prevCursor = state.cursor - 1
  return {
    entryId: state.history[prevCursor],
    shuffleState: {
      ...state,
      cursor: prevCursor,
    },
  }
}

export function insertShuffleEntry(
  state: ShuffleState,
  newEntryId: string,
  rng: RandomFn = Math.random,
): ShuffleState {
  const playedInCycle = new Set(state.history.slice(state.cycleStartIndex))
  let firstUnplayedIdx = state.order.findIndex((id) => !playedInCycle.has(id))
  if (firstUnplayedIdx === -1) {
    firstUnplayedIdx = state.order.length
  }

  const unplayedSpan = state.order.length - firstUnplayedIdx
  const raw = rng()
  const bounded = Number.isFinite(raw) ? Math.min(0.999999999999, Math.max(0, raw)) : 0
  const insertIdx = firstUnplayedIdx + Math.floor(bounded * (unplayedSpan + 1))

  const nextOrder = [...state.order]
  nextOrder.splice(insertIdx, 0, newEntryId)

  return {
    ...state,
    order: nextOrder,
  }
}

export function removeShuffleEntry(
  state: ShuffleState,
  removedEntryId: string,
  replacementEntryId?: string | null,
): ShuffleState {
  const nextOrder = state.order.filter((id) => id !== removedEntryId)
  const nextHistory: string[] = []
  let nextCursor = state.cursor
  let nextCycleStartIndex = state.cycleStartIndex

  for (let i = 0; i < state.history.length; i++) {
    const id = state.history[i]
    if (id === removedEntryId) {
      if (i <= state.cursor) {
        nextCursor -= 1
      }
      if (i < state.cycleStartIndex) {
        nextCycleStartIndex -= 1
      }
    } else {
      nextHistory.push(id)
    }
  }

  if (nextHistory.length === 0) {
    nextCursor = -1
    nextCycleStartIndex = 0
  } else {
    nextCursor = Math.max(0, Math.min(nextHistory.length - 1, nextCursor))
    nextCycleStartIndex = Math.max(0, Math.min(nextHistory.length, nextCycleStartIndex))
  }

  if (replacementEntryId) {
    if (nextHistory.length === 0 || nextCursor < 0) {
      nextHistory.push(replacementEntryId)
      nextCursor = 0
      nextCycleStartIndex = 0
    } else if (nextHistory[nextCursor] !== replacementEntryId) {
      nextHistory.splice(nextCursor + 1, nextHistory.length - (nextCursor + 1), replacementEntryId)
      nextCursor = nextHistory.length - 1
    }
  }

  return {
    order: nextOrder,
    cursor: nextCursor,
    cycleStartIndex: nextCycleStartIndex,
    history: nextHistory,
  }
}
