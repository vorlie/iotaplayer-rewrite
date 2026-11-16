import test from 'node:test'
import assert from 'node:assert/strict'
import net from 'node:net'
import path from 'node:path'
import os from 'node:os'

const {
  DEFAULT_VOLUME,
  normalizeVolume,
  toMpvVolume,
  fromMpvVolume,
  VolumeController,
} = await import('../dist-electron/volume.js')

const { MpvController } = await import('../dist-electron/mpv.js')

test('normalizeVolume, toMpvVolume, and fromMpvVolume handle bounds and string/number inputs', () => {
  assert.equal(normalizeVolume(0.2), 0.2)
  assert.equal(normalizeVolume('0.5'), 0.5)
  assert.equal(normalizeVolume('1'), 1)
  assert.equal(normalizeVolume('0'), 0)
  assert.equal(normalizeVolume(0), 0)
  assert.equal(normalizeVolume(-0.4), 0)
  assert.equal(normalizeVolume(1.5), 1)
  assert.equal(normalizeVolume('invalid', 0.35), 0.35)
  assert.equal(normalizeVolume(undefined), DEFAULT_VOLUME)

  assert.equal(toMpvVolume(0.2), 20)
  assert.equal(toMpvVolume(0.5), 50)
  assert.equal(toMpvVolume(1.0), 100)
  assert.equal(toMpvVolume(0), 0)

  assert.equal(fromMpvVolume(20), 0.2)
  assert.equal(fromMpvVolume(50), 0.5)
  assert.equal(fromMpvVolume(100), 1)
  assert.equal(fromMpvVolume(0), 0)
})

test('cold launch restores 20%, 50%, and 100% persisted volumes across backends', async () => {
  for (const persisted of ['0.2', '0.5', '1.0']) {
    const expected = Number(persisted)
    let mpvApplied = null
    const createdElements = []

    const controller = new VolumeController({
      loadPersistedVolume: async () => persisted,
      applyMpvVolume: (vol) => {
        mpvApplied = vol
      },
      createAudioElement: () => {
        const el = { volume: 1.0 } // Native HTMLAudioElement starts at 1.0
        createdElements.push(el)
        return el
      },
    })

    const hydrated = await controller.ensureHydrated()
    assert.equal(hydrated, expected)
    assert.equal(controller.getVolume(), expected)
    assert.equal(controller.getAudioElement().volume, expected)
    assert.equal(mpvApplied, expected)
  }
})

test('changing volume before async startup hydration finishes is not overwritten by stale persisted volume', async () => {
  let resolveHydration
  const hydrationGate = new Promise((resolve) => {
    resolveHydration = resolve
  })

  const mpvCalls = []
  const persistedCalls = []
  const controller = new VolumeController({
    loadPersistedVolume: () => hydrationGate,
    applyMpvVolume: (vol) => mpvCalls.push(vol),
    persistVolume: (vol) => persistedCalls.push(vol),
    createAudioElement: () => ({ volume: 1.0 }),
  })

  // Start async hydration (which will eventually resolve with old 0.8)
  const pendingHydration = controller.ensureHydrated()

  // User changes volume to 20% before hydration completes
  const applied = controller.setVolume(0.2)
  assert.equal(applied, 0.2)
  assert.equal(controller.getVolume(), 0.2)
  assert.equal(controller.getAudioElement().volume, 0.2)
  assert.deepEqual(persistedCalls, [0.2])

  // Now the initial hydration resolves with the stale saved value "0.8"
  resolveHydration('0.8')
  const finalVol = await pendingHydration

  assert.equal(finalVol, 0.2)
  assert.equal(controller.getVolume(), 0.2)
  assert.equal(controller.getAudioElement().volume, 0.2)
  assert.equal(mpvCalls[mpvCalls.length - 1], 0.2)
})

test('starting playback immediately on cold launch waits for hydration and avoids a 100% volume spike', async () => {
  const observedPlayVolumes = []
  const rawAudio = {
    volume: 1.0,
    play() {
      observedPlayVolumes.push(this.volume)
    },
  }

  const controller = new VolumeController({
    loadPersistedVolume: async () => {
      await new Promise((r) => setTimeout(r, 15))
      return '0.2'
    },
    createAudioElement: () => rawAudio,
  })

  // Immediately prepare for browser playback on cold launch before hydration has resolved
  const appliedBeforePlay = await controller.prepareForPlayback('browser')
  rawAudio.play()

  assert.equal(appliedBeforePlay, 0.2)
  assert.deepEqual(observedPlayVolumes, [0.2])
  assert.notEqual(observedPlayVolumes[0], 1.0)
  assert.notEqual(observedPlayVolumes[0], 0.8)
})

test('switching between MPV and browser backends and recreating audio element preserves logical volume', async () => {
  let mpvVolume = 0.8
  let persistedState = '0.5'

  const controller = new VolumeController({
    loadPersistedVolume: async () => persistedState,
    persistVolume: (vol) => {
      persistedState = String(vol)
    },
    applyMpvVolume: (vol) => {
      mpvVolume = vol
    },
    createAudioElement: () => ({ volume: 1.0 }),
  })

  await controller.ensureHydrated()
  assert.equal(controller.getVolume(), 0.5)
  assert.equal(mpvVolume, 0.5)
  assert.equal(controller.getAudioElement().volume, 0.5)

  // 1. User changes volume to 0.35 while on MPV, then switches to browser backend
  controller.setVolume(0.35)
  await controller.prepareForPlayback('browser')
  assert.equal(controller.getAudioElement().volume, 0.35)
  assert.equal(mpvVolume, 0.35)

  // 2. User changes volume to 0.15 while on browser backend, then switches to MPV
  controller.setVolume(0.15)
  await controller.prepareForPlayback('mpv')
  assert.equal(mpvVolume, 0.15)
  assert.equal(controller.getAudioElement().volume, 0.15)

  // 3. Recreate browser audio element and verify it immediately inherits 0.15 (never 1.0)
  const replacementAudio = controller.recreateAudioElement()
  assert.equal(replacementAudio.volume, 0.15)
  assert.equal(controller.getAudioElement().volume, 0.15)

  // 4. Simulate application restart reading from persistedState
  const restartedController = new VolumeController({
    loadPersistedVolume: async () => persistedState,
    createAudioElement: () => ({ volume: 1.0 }),
  })
  await restartedController.ensureHydrated()
  assert.equal(restartedController.getVolume(), 0.15)
  assert.equal(restartedController.getAudioElement().volume, 0.15)
})

test('MpvController applies volume changed during async socket connection before observing volume', async () => {
  const mpv = new MpvController()
  const testPipe =
    process.platform === 'win32'
      ? `\\\\.\\pipe\\iotaplayer-mpv-test-${process.pid}-${Date.now()}`
      : path.join(os.tmpdir(), `iotaplayer-mpv-test-${process.pid}-${Date.now()}.sock`)

  mpv.pipePath = testPipe
  // Stub spawnProcess so we can simulate the MPV IPC socket server directly
  mpv.spawnProcess = () => {}

  const receivedCommands = []
  const server = net.createServer((client) => {
    let buf = ''
    client.on('data', (chunk) => {
      buf += chunk.toString('utf8')
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        const parsed = JSON.parse(line)
        receivedCommands.push(parsed.command)
      }
    })
  })

  try {
    // Begin init before server is listening (simulating MPV process startup delay)
    const initPromise = mpv.init()

    // Change volume to 25% while MPV is still initializing/connecting
    mpv.setVolume(0.25)
    assert.equal(mpv.getVolume(), 0.25)

    // Start listening on the IPC socket so connectSocket succeeds on its retry
    await new Promise((resolve) => server.listen(testPipe, resolve))
    await initPromise

    // Wait briefly for initial observer setup commands to arrive at server
    await new Promise((r) => setTimeout(r, 30))

    assert.ok(receivedCommands.length > 0)
    // The very first command sent on socket connect must set volume to 25 before observe_property volume
    assert.deepEqual(receivedCommands[0], ['set_property', 'volume', 25])
    const observeVolIndex = receivedCommands.findIndex(
      (cmd) => cmd[0] === 'observe_property' && cmd[2] === 'volume',
    )
    assert.ok(observeVolIndex > 0)
  } finally {
    mpv.destroy()
    await new Promise((resolve) => server.close(resolve))
  }
})
