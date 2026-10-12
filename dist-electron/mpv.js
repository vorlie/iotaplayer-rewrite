"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MpvController = void 0;
exports.getMpv = getMpv;
const child_process_1 = require("child_process");
const net_1 = __importDefault(require("net"));
const path_1 = __importDefault(require("path"));
class MpvController {
    process = null;
    socket = null;
    pipePath;
    buffer = '';
    isConnected = false;
    isDestroyed = false;
    isPlaying = false;
    currentVolume = 0.8;
    onStateChangeCb;
    onTrackEndedCb;
    constructor() {
        this.pipePath =
            process.platform === 'win32'
                ? `\\\\.\\pipe\\iotaplayer-mpv-${process.pid}`
                : path_1.default.join('/tmp', `iotaplayer-mpv-${process.pid}.sock`);
    }
    setCallbacks(onStateChange, onTrackEnded) {
        this.onStateChangeCb = onStateChange;
        this.onTrackEndedCb = onTrackEnded;
    }
    init() {
        return new Promise((resolve) => {
            this.spawnProcess();
            this.connectSocket(resolve);
        });
    }
    spawnProcess() {
        const args = [
            '--idle=yes',
            '--no-video',
            '--no-terminal',
            `--input-ipc-server=${this.pipePath}`,
            '--keep-open=yes',
            '--gapless-audio=yes',
            `--volume=${Math.round(this.currentVolume * 100)}`,
        ];
        try {
            this.process = (0, child_process_1.spawn)('mpv', args, {
                windowsHide: true,
                stdio: 'ignore',
            });
            this.process.on('error', (err) => {
                console.error('[MPV] Process error:', err.message);
            });
            this.process.on('exit', (code, signal) => {
                console.log(`[MPV] Process exited with code ${code}, signal ${signal}`);
                this.process = null;
                this.isConnected = false;
            });
        }
        catch (err) {
            console.error('[MPV] Failed to spawn mpv process:', err);
        }
    }
    connectSocket(onReady, retryCount = 0) {
        if (this.isDestroyed)
            return;
        const socket = net_1.default.connect(this.pipePath, () => {
            console.log('[MPV] Connected to IPC socket');
            this.socket = socket;
            this.isConnected = true;
            this.setupObservers();
            onReady?.();
        });
        socket.on('data', (data) => {
            this.handleSocketData(data);
        });
        socket.on('error', (_err) => {
            if (!this.isConnected && retryCount < 30) {
                setTimeout(() => this.connectSocket(onReady, retryCount + 1), 100);
            }
        });
        socket.on('close', () => {
            this.isConnected = false;
            this.socket = null;
        });
    }
    sendCommand(command) {
        if (!this.socket || !this.isConnected) {
            return;
        }
        const payload = JSON.stringify({ command }) + '\n';
        this.socket.write(payload);
    }
    setupObservers() {
        // Observe core playback properties
        this.sendCommand(['observe_property', 1, 'time-pos']);
        this.sendCommand(['observe_property', 2, 'duration']);
        this.sendCommand(['observe_property', 3, 'pause']);
        this.sendCommand(['observe_property', 4, 'volume']);
    }
    handleSocketData(chunk) {
        this.buffer += chunk.toString('utf8');
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop() ?? '';
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed)
                continue;
            try {
                const msg = JSON.parse(trimmed);
                this.handleMpvMessage(msg);
            }
            catch {
                // incomplete json
            }
        }
    }
    handleMpvMessage(msg) {
        if (msg.event === 'property-change') {
            if (msg.name === 'time-pos') {
                const pos = typeof msg.data === 'number' ? msg.data : 0;
                this.onStateChangeCb?.({ position: pos });
            }
            else if (msg.name === 'duration') {
                const dur = typeof msg.data === 'number' ? msg.data : 0;
                this.onStateChangeCb?.({ duration: dur });
            }
            else if (msg.name === 'pause') {
                const isPaused = Boolean(msg.data);
                this.isPlaying = !isPaused;
                this.onStateChangeCb?.({ isPlaying: this.isPlaying });
            }
            else if (msg.name === 'volume') {
                const vol = typeof msg.data === 'number' ? msg.data / 100 : 0.8;
                this.currentVolume = vol;
                this.onStateChangeCb?.({ volume: vol });
            }
        }
        else if (msg.event === 'end-file') {
            // eof = track reached end naturally
            if (msg.reason === 'eof') {
                console.log('[MPV] Track finished (EOF)');
                this.isPlaying = false;
                this.onStateChangeCb?.({ isPlaying: false });
                this.onTrackEndedCb?.();
            }
        }
    }
    async play(filePath) {
        if (!this.isConnected) {
            await this.init();
        }
        console.log(`[MPV] Playing file: ${filePath}`);
        this.sendCommand(['loadfile', filePath, 'replace']);
        this.sendCommand(['set_property', 'pause', false]);
        this.isPlaying = true;
        this.onStateChangeCb?.({ isPlaying: true });
    }
    pause() {
        this.sendCommand(['set_property', 'pause', true]);
        this.isPlaying = false;
        this.onStateChangeCb?.({ isPlaying: false });
    }
    resume() {
        this.sendCommand(['set_property', 'pause', false]);
        this.isPlaying = true;
        this.onStateChangeCb?.({ isPlaying: true });
    }
    toggle() {
        if (this.isPlaying) {
            this.pause();
        }
        else {
            this.resume();
        }
    }
    seek(positionSeconds) {
        this.sendCommand(['seek', Math.max(0, positionSeconds), 'absolute']);
        this.onStateChangeCb?.({ position: Math.max(0, positionSeconds) });
    }
    setVolume(vol) {
        const clamped = Math.max(0, Math.min(1, vol));
        this.currentVolume = clamped;
        this.sendCommand(['set_property', 'volume', Math.round(clamped * 100)]);
        this.onStateChangeCb?.({ volume: clamped });
    }
    stop() {
        this.sendCommand(['stop']);
        this.isPlaying = false;
        this.onStateChangeCb?.({ isPlaying: false, position: 0 });
    }
    destroy() {
        this.isDestroyed = true;
        try {
            if (this.isConnected && this.socket) {
                this.sendCommand(['stop']);
                this.sendCommand(['quit']);
            }
            setTimeout(() => {
                try {
                    if (this.socket) {
                        this.socket.destroy();
                        this.socket = null;
                    }
                    if (this.process && !this.process.killed) {
                        this.process.kill();
                        this.process = null;
                    }
                }
                catch (err) {
                    console.error('[MPV] Error destroying mpv:', err);
                }
            }, 150);
        }
        catch (err) {
            console.error('[MPV] Error destroying mpv:', err);
        }
    }
}
exports.MpvController = MpvController;
// Global singleton instance
let mpvInstance = null;
function getMpv() {
    if (!mpvInstance) {
        mpvInstance = new MpvController();
    }
    return mpvInstance;
}
