import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { buildSync } from 'esbuild'

const {
  createQueueEntryIds,
  createEmptyShuffleState,
  fisherYatesShuffle,
  initShuffleState,
  advanceShuffleNext,
  stepShufflePrevious,
  insertShuffleEntry,
  removeShuffleEntry,
} = await import('../dist-electron/shuffle.js')

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iotaplayer-shuffle-test-'))
const bundledStorePath = path.join(tempDir, 'store.mjs')
buildSync({
  entryPoints: ['src/store/index.ts'],
  outfile: bundledStorePath,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  mainFields: ['module', 'main'],
})
const { usePlaybackStore } = await import(pathToFileURL(bundledStorePath).href)

test.after(() => {
  fs.rmSync(tempDir, { recursive: true, force: true })
})

function makeRng(seed = 12345) {
  let s = seed >>> 0
  return () => {
    s += 0x6d2b79f5
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeTrack(id, title = `Track ${id}`) {
  return {
    id,
    title,
    artist: 'Artist',
    album_artist: 'Artist',
    album: 'Album',
    album_id: 1,
    artist_id: 1,
    track_number: id,
    track_total: 10,
    disc_number: 1,
    disc_total: 1,
    year: 2026,
    genre: 'Electronic',
    duration: 180,
    bitrate: 320,
    codec: 'flac',
    format: 'flac',
    path: `/music/track-${id}.flac`,
    file_size: 1024,
    modified_time: 1000,
    artwork_id: null,
  }
}

function resetStore() {
  usePlaybackStore.setState({
    currentTrack: null,
    isPlaying: false,
    position: 0,
    duration: 0,
    queue: [],
    queueEntryIds: [],
    queueIndex: -1,
    playlistName: 'Queue',
    repeatMode: 'off',
    shuffle: false,
    shuffleState: createEmptyShuffleState(),
  })
}

// ---------------------------------------------------------------------------
// 1. Shuffle produces a permutation with no duplicate entries
// ---------------------------------------------------------------------------

test('1. fisherYatesShuffle and initShuffleState produce a permutation with no duplicate entries', () => {
  const rng = makeRng(42)
  const items = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6']
  const shuffled = fisherYatesShuffle(items, rng)

  assert.equal(shuffled.length, items.length)
  assert.deepEqual([...shuffled].sort(), [...items].sort())
  assert.equal(new Set(shuffled).size, items.length)

  const state = initShuffleState(items, 'e3', makeRng(99))
  assert.equal(state.order[0], 'e3')
  assert.equal(state.order.length, items.length)
  assert.equal(new Set(state.order).size, items.length)
  assert.deepEqual(state.history, ['e3'])
  assert.equal(state.cursor, 0)
})

// ---------------------------------------------------------------------------
// 2. Every queued entry is played once before a new cycle begins
// ---------------------------------------------------------------------------

test('2. every queued entry is played once before a new cycle begins', () => {
  const rng = makeRng(7)
  const entryIds = ['e1', 'e2', 'e3', 'e4', 'e5']
  let state = initShuffleState(entryIds, 'e2', rng)

  const played = [state.history[0]]
  for (let i = 0; i < entryIds.length - 1; i++) {
    const res = advanceShuffleNext(state, entryIds, 'off', rng)
    assert.equal(res.ended, false)
    assert.ok(res.entryId)
    played.push(res.entryId)
    state = res.shuffleState
  }

  assert.equal(played.length, entryIds.length)
  assert.equal(new Set(played).size, entryIds.length)
  assert.deepEqual([...played].sort(), [...entryIds].sort())
})

// ---------------------------------------------------------------------------
// 3 & 4. Previous returns to actual previous entry; Next replays forward history
// ---------------------------------------------------------------------------

test('3 & 4. previous navigates actual playback history and next replays forward history before continuing', () => {
  const rng = makeRng(101)
  const entryIds = ['e1', 'e2', 'e3', 'e4', 'e5']
  let state = initShuffleState(entryIds, 'e1', rng)

  const step1 = advanceShuffleNext(state, entryIds, 'off', rng)
  state = step1.shuffleState
  const step2 = advanceShuffleNext(state, entryIds, 'off', rng)
  state = step2.shuffleState

  const playedOrder = [state.history[0], state.history[1], state.history[2]]

  // Step back twice
  const back1 = stepShufflePrevious(state)
  assert.equal(back1.entryId, playedOrder[1])
  state = back1.shuffleState

  const back2 = stepShufflePrevious(state)
  assert.equal(back2.entryId, playedOrder[0])
  state = back2.shuffleState

  // Cannot go before start of history
  const back3 = stepShufflePrevious(state)
  assert.equal(back3.entryId, null)

  // Step forward: must replay playedOrder[1], then playedOrder[2]
  const fwd1 = advanceShuffleNext(state, entryIds, 'off', rng)
  assert.equal(fwd1.entryId, playedOrder[1])
  state = fwd1.shuffleState

  const fwd2 = advanceShuffleNext(state, entryIds, 'off', rng)
  assert.equal(fwd2.entryId, playedOrder[2])
  state = fwd2.shuffleState

  // Now at tip of history: next must pick an unplayed track
  const fwd3 = advanceShuffleNext(state, entryIds, 'off', rng)
  assert.equal(fwd3.ended, false)
  assert.ok(fwd3.entryId && !playedOrder.includes(fwd3.entryId))
})

// ---------------------------------------------------------------------------
// 5 & 6. Enabling and disabling shuffle preserves the currently playing entry
// ---------------------------------------------------------------------------

test('5 & 6. enabling and disabling shuffle in store preserves the currently playing entry', () => {
  resetStore()
  const tracks = [makeTrack(1), makeTrack(2), makeTrack(3), makeTrack(4)]
  const store = usePlaybackStore.getState()

  store.play(tracks[2], tracks, 'Test Album')
  assert.equal(usePlaybackStore.getState().currentTrack?.id, 3)
  assert.equal(usePlaybackStore.getState().queueIndex, 2)

  // Enable shuffle
  usePlaybackStore.getState().toggleShuffle()
  const afterEnable = usePlaybackStore.getState()
  assert.equal(afterEnable.shuffle, true)
  assert.equal(afterEnable.currentTrack?.id, 3)
  assert.equal(afterEnable.queueIndex, 2)
  assert.equal(afterEnable.shuffleState.order[0], afterEnable.queueEntryIds[2])

  // Advance one shuffled track, then disable shuffle
  usePlaybackStore.getState().next()
  const midShuffle = usePlaybackStore.getState()
  const playingTrack = midShuffle.currentTrack
  const playingIndex = midShuffle.queueIndex
  assert.ok(playingTrack)

  usePlaybackStore.getState().toggleShuffle()
  const afterDisable = usePlaybackStore.getState()
  assert.equal(afterDisable.shuffle, false)
  assert.equal(afterDisable.currentTrack?.id, playingTrack.id)
  assert.equal(afterDisable.queueIndex, playingIndex)
  assert.deepEqual(afterDisable.shuffleState, createEmptyShuffleState())
})

// ---------------------------------------------------------------------------
// 7. Adding entries during playback makes them eligible without replaying played ones
// ---------------------------------------------------------------------------

test('7. adding entries during shuffled playback inserts them into unplayed portion without replaying played entries', () => {
  resetStore()
  const tracks = [makeTrack(1), makeTrack(2), makeTrack(3)]
  usePlaybackStore.getState().play(tracks[0], tracks, 'Queue')
  usePlaybackStore.getState().toggleShuffle()

  // Play second track
  usePlaybackStore.getState().next()
  const beforeAdd = usePlaybackStore.getState()
  const playedIds = [...beforeAdd.shuffleState.history]
  assert.equal(playedIds.length, 2)

  // Add a 4th track mid-cycle
  const track4 = makeTrack(4)
  usePlaybackStore.getState().addToQueue(track4)

  const afterAdd = usePlaybackStore.getState()
  assert.equal(afterAdd.queue.length, 4)
  const newEntryId = afterAdd.queueEntryIds[3]
  assert.ok(afterAdd.shuffleState.order.includes(newEntryId))

  // Finish the cycle: both the remaining track and track 4 must play once, and playedIds must not repeat
  const seen = new Set(playedIds)
  usePlaybackStore.getState().next()
  seen.add(usePlaybackStore.getState().queueEntryIds[usePlaybackStore.getState().queueIndex])
  usePlaybackStore.getState().next()
  seen.add(usePlaybackStore.getState().queueEntryIds[usePlaybackStore.getState().queueIndex])

  assert.equal(seen.size, 4)
  assert.ok(seen.has(newEntryId))
})

// ---------------------------------------------------------------------------
// 8. Removing entries does not leave invalid shuffle references
// ---------------------------------------------------------------------------

test('8. removing entries cleans up shuffle order and history without invalid references', () => {
  const rng = makeRng(55)
  const entryIds = ['e1', 'e2', 'e3', 'e4']
  let state = initShuffleState(entryIds, 'e1', rng)

  const s1 = advanceShuffleNext(state, entryIds, 'off', rng)
  state = s1.shuffleState
  const secondEntry = s1.entryId
  const s2 = advanceShuffleNext(state, entryIds, 'off', rng)
  state = s2.shuffleState

  // Remove the previously played secondEntry
  const remaining = entryIds.filter((id) => id !== secondEntry)
  state = removeShuffleEntry(state, secondEntry)

  assert.equal(state.order.includes(secondEntry), false)
  assert.equal(state.history.includes(secondEntry), false)
  assert.ok(state.cursor >= 0 && state.cursor < state.history.length)

  // Stepping back should skip removed entry and reach e1 cleanly
  const back = stepShufflePrevious(state)
  assert.equal(back.entryId, 'e1')

  // Remaining unplayed entry still plays
  const next = advanceShuffleNext(state, remaining, 'off', rng)
  assert.equal(next.ended, false)
  assert.ok(next.entryId && remaining.includes(next.entryId))
})

// ---------------------------------------------------------------------------
// 9. Reordering the queue does not corrupt playback history
// ---------------------------------------------------------------------------

test('9. reordering the queue preserves playback history and shuffled order via stable entry IDs', () => {
  resetStore()
  const tracks = [makeTrack(1), makeTrack(2), makeTrack(3), makeTrack(4)]
  usePlaybackStore.getState().play(tracks[0], tracks, 'Queue')
  usePlaybackStore.getState().toggleShuffle()

  usePlaybackStore.getState().next()
  const beforeMove = usePlaybackStore.getState()
  const expectedHistory = [...beforeMove.shuffleState.history]
  const expectedOrder = [...beforeMove.shuffleState.order]
  const activeTrackId = beforeMove.currentTrack?.id

  // Move index 0 to index 3
  usePlaybackStore.getState().moveQueueItem(0, 3)
  const afterMove = usePlaybackStore.getState()

  assert.deepEqual(afterMove.shuffleState.history, expectedHistory)
  assert.deepEqual(afterMove.shuffleState.order, expectedOrder)
  assert.equal(afterMove.currentTrack?.id, activeTrackId)
  assert.equal(afterMove.queue[afterMove.queueIndex]?.id, activeTrackId)

  // Previous still navigates back to track 1 regardless of its new array index
  usePlaybackStore.getState().previous()
  const afterPrev = usePlaybackStore.getState()
  assert.equal(afterPrev.currentTrack?.id, 1)
  assert.equal(afterPrev.queueIndex, 3)
})

// ---------------------------------------------------------------------------
// 10. Repeat All starts a new cycle without immediately repeating the ending entry
// ---------------------------------------------------------------------------

test('10. Repeat All starts a new shuffle cycle without immediately repeating the ending entry', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const rng = makeRng(seed)
    const entryIds = ['e1', 'e2', 'e3']
    let state = initShuffleState(entryIds, 'e1', rng)

    // Exhaust cycle 1
    for (let i = 0; i < entryIds.length - 1; i++) {
      state = advanceShuffleNext(state, entryIds, 'all', rng).shuffleState
    }
    const cycle1Last = state.history[state.cursor]

    // Advance into cycle 2
    const cycle2Start = advanceShuffleNext(state, entryIds, 'all', rng)
    assert.equal(cycle2Start.ended, false)
    assert.notEqual(cycle2Start.entryId, cycle1Last)

    // Previous from cycle 2 start still navigates back to cycle 1's last track
    const backAcrossBoundary = stepShufflePrevious(cycle2Start.shuffleState)
    assert.equal(backAcrossBoundary.entryId, cycle1Last)
  }
})

// ---------------------------------------------------------------------------
// 11. Repeat Off stops correctly at the end of the shuffle cycle
// ---------------------------------------------------------------------------

test('11. Repeat Off stops playback cleanly at the end of the shuffle cycle', () => {
  resetStore()
  const tracks = [makeTrack(1), makeTrack(2), makeTrack(3)]
  usePlaybackStore.getState().play(tracks[0], tracks, 'Queue')
  usePlaybackStore.getState().setRepeatMode('off')
  usePlaybackStore.getState().toggleShuffle()

  usePlaybackStore.getState().next()
  usePlaybackStore.getState().next()
  assert.equal(usePlaybackStore.getState().isPlaying, true)

  // 3rd next exhausts the 3-track cycle
  usePlaybackStore.getState().next()
  const endedState = usePlaybackStore.getState()
  assert.equal(endedState.isPlaying, false)
  assert.equal(endedState.position, 0)
})

// ---------------------------------------------------------------------------
// 12. Duplicate tracks with different queue-entry IDs remain independently playable
// ---------------------------------------------------------------------------

test('12. duplicate tracks with distinct queue-entry IDs are each played once per cycle', () => {
  resetStore()
  const dupA = makeTrack(77, 'Same Track')
  const dupB = makeTrack(77, 'Same Track')
  const other = makeTrack(88, 'Other Track')
  const tracks = [dupA, other, dupB]

  usePlaybackStore.getState().play(dupA, tracks, 'Duplicates')
  usePlaybackStore.getState().toggleShuffle()

  const visitedQueueIndices = [usePlaybackStore.getState().queueIndex]
  usePlaybackStore.getState().next()
  visitedQueueIndices.push(usePlaybackStore.getState().queueIndex)
  usePlaybackStore.getState().next()
  visitedQueueIndices.push(usePlaybackStore.getState().queueIndex)

  assert.deepEqual([...visitedQueueIndices].sort((a, b) => a - b), [0, 1, 2])
  assert.equal(new Set(usePlaybackStore.getState().queueEntryIds).size, 3)
})

// ---------------------------------------------------------------------------
// 13. Single-entry and empty queues do not cause infinite loops or invalid indices
// ---------------------------------------------------------------------------

test('13. single-entry and empty queues handle next, previous, and repeat safely without infinite loops', () => {
  const rng = makeRng(1)

  // Empty queue
  const emptyState = createEmptyShuffleState()
  const emptyNext = advanceShuffleNext(emptyState, [], 'all', rng)
  assert.equal(emptyNext.ended, true)
  assert.equal(emptyNext.entryId, null)
  const emptyPrev = stepShufflePrevious(emptyState)
  assert.equal(emptyPrev.entryId, null)

  // Single-entry queue with Repeat Off
  const singleIds = createQueueEntryIds(1)
  let singleState = initShuffleState(singleIds, singleIds[0], rng)
  const singleOffNext = advanceShuffleNext(singleState, singleIds, 'off', rng)
  assert.equal(singleOffNext.ended, true)
  assert.equal(singleOffNext.entryId, null)

  // Single-entry queue with Repeat All
  const singleAllNext = advanceShuffleNext(singleState, singleIds, 'all', rng)
  assert.equal(singleAllNext.ended, false)
  assert.equal(singleAllNext.entryId, singleIds[0])
  singleState = singleAllNext.shuffleState

  const singlePrev = stepShufflePrevious(singleState)
  assert.equal(singlePrev.entryId, singleIds[0])

  // insertShuffleEntry on empty order
  const inserted = insertShuffleEntry(createEmptyShuffleState(), 'qe-solo', rng)
  assert.deepEqual(inserted.order, ['qe-solo'])
})
