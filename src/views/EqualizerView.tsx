import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Gauge, RotateCcw, SlidersHorizontal } from "lucide-react";
import {
  calculatePitchSemitones,
  DEFAULT_PLAYBACK_RATE,
  formatPitchSemitones,
  formatPlaybackRate,
  getPlaybackSpeedPreset,
  matchPlaybackSpeedPreset,
  MAX_PLAYBACK_RATE,
  MIN_PLAYBACK_RATE,
  PLAYBACK_RATE_STEP,
  PLAYBACK_SPEED_PRESETS,
  normalizePlaybackRate,
} from "../../electron/playbackSpeed";
import { usePlaybackStore } from "../store";
import "../styles/settings.css";

const DEFAULT_EQUALIZER_BANDS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const EQUALIZER_BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const EQUALIZER_PRESETS: Record<string, number[]> = {
  Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  Warm: [2, 3, 4, 3, 2, 0, -1, -2, -1, 0],
  Bright: [-1, -1, 0, 1, 2, 3, 2, 1, 0, -1],
  Bass: [5, 4, 3, 2, 1, 0, -1, -2, -2, -1],
  Vocal: [0, 0, -1, 0, 2, 4, 3, 1, 0, 0],
  Club: [3, 2, 1, 0, 2, 4, 5, 4, 3, 2],
};

const EQ_MIN = -12;
const EQ_MAX = 12;
const EQ_STEP = 0.5;

const EQ_SCALE_MARKS = Array.from(
  { length: EQ_MAX - EQ_MIN + 1 },
  (_, index) => EQ_MIN + index,
);

const SPEED_SCALE_TICKS = [0.5, 0.75, 1.0, 1.16, 1.25, 1.5];

export function EqualizerView() {
  const { t } = useTranslation("settings");
  const {
    playbackRate,
    preservePitch,
    setPlaybackSpeed,
    resetPlaybackSpeed,
  } = usePlaybackStore();

  const [equalizerEnabled, setEqualizerEnabled] = useState(false);
  const [equalizerPreset, setEqualizerPreset] = useState("Flat");
  const [equalizerBands, setEqualizerBands] = useState<number[]>(
    DEFAULT_EQUALIZER_BANDS,
  );
  const [editingSpeedText, setEditingSpeedText] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const activeSpeedPreset = matchPlaybackSpeedPreset({
    playbackRate,
    preservePitch,
  });
  const pitchSemitones = calculatePitchSemitones(playbackRate, preservePitch);
  const displayedSpeedText = editingSpeedText ?? playbackRate.toFixed(2);

  useEffect(() => {
    void window.settings.get().then((settings) => {
      setEqualizerEnabled(settings.equalizerEnabled);
      setEqualizerPreset(settings.equalizerPreset || "Flat");
      setEqualizerBands(
        settings.equalizerBands?.length
          ? settings.equalizerBands
          : DEFAULT_EQUALIZER_BANDS,
      );
      if (
        settings.playbackRate !== undefined ||
        settings.preservePitch !== undefined
      ) {
        setPlaybackSpeed({
          playbackRate: settings.playbackRate,
          preservePitch: settings.preservePitch,
        });
      }
    });
  }, [setPlaybackSpeed]);

  useEffect(() => {
    if (!equalizerEnabled) {
      void window.playback.setEqualizer(DEFAULT_EQUALIZER_BANDS);
      return;
    }

    void window.playback.setEqualizer(equalizerBands);
  }, [equalizerEnabled, equalizerBands]);

  async function handleSaveSettings() {
    setSavingSettings(true);
    try {
      await window.settings.set({
        equalizerEnabled,
        equalizerPreset,
        equalizerBands,
        playbackRate,
        preservePitch,
      });
      await window.playback.setEqualizer(
        equalizerEnabled ? equalizerBands : DEFAULT_EQUALIZER_BANDS,
      );
      await window.playback.setPlaybackSpeed({
        playbackRate,
        preservePitch,
      });
    } finally {
      setSavingSettings(false);
    }
  }

  function applyEqPreset(name: string) {
    const preset = EQUALIZER_PRESETS[name];
    if (!preset) return;

    setEqualizerPreset(name);
    setEqualizerBands([...preset]);
  }

  function updateBand(index: number, value: number) {
    setEqualizerBands((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
    setEqualizerPreset("Custom");
  }

  function handleSpeedPresetSelect(name: string) {
    const preset = getPlaybackSpeedPreset(name);
    if (!preset) return;
    setPlaybackSpeed({
      playbackRate: preset.playbackRate,
      preservePitch: preset.preservePitch,
    });
  }

  function handleSpeedSliderChange(nextValue: number) {
    const normalized = normalizePlaybackRate(nextValue, playbackRate);
    setPlaybackSpeed({ playbackRate: normalized });
  }

  function commitNumericSpeedInput() {
    if (editingSpeedText === null) return;
    const normalized = normalizePlaybackRate(editingSpeedText, playbackRate);
    setEditingSpeedText(null);
    setPlaybackSpeed({ playbackRate: normalized });
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{t("equalizer.title")}</h1>
        <p className="page-subtitle">
          {t("equalizer.subtitle")}
        </p>
      </div>

      <div className="page-body eq-page-body">
        <div className="eq-shell">
          {/* Speed & Pitch Section */}
          <section className="eq-panel speed-panel" aria-label={t("equalizer.speedAria")}>
            <div className="eq-panel__header speed-panel__header">
              <div className="eq-panel__label">
                <Gauge size={14} />
                <span>{t("equalizer.speedSection")}</span>
              </div>

              <div className="speed-readout-badges">
                <span
                  className={`speed-badge ${
                    playbackRate !== DEFAULT_PLAYBACK_RATE ? "speed-badge--active" : ""
                  }`}
                  title={t("equalizer.rateTitle")}
                >
                  {formatPlaybackRate(playbackRate)}
                </span>

                {!preservePitch && (
                  <span
                    className="speed-badge speed-badge--pitch"
                    title={t("equalizer.pitchTitle")}
                  >
                    {t("equalizer.pitchBadge", { shift: formatPitchSemitones(pitchSemitones) })}
                  </span>
                )}

                <span
                  className={`speed-badge ${
                    activeSpeedPreset === "Custom" ? "speed-badge--custom" : "speed-badge--preset"
                  }`}
                >
                  {activeSpeedPreset === "Custom"
                    ? t("equalizer.custom")
                    : t(`equalizer.presets.${activeSpeedPreset}.name` as never, { defaultValue: activeSpeedPreset })}
                </span>
              </div>
            </div>

            {/* Single-click preset pills */}
            <div className="speed-presets-row" role="group" aria-label={t("equalizer.presetsAria")}>
              {PLAYBACK_SPEED_PRESETS.map((preset) => {
                const isSelected = activeSpeedPreset === preset.name;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    className={`speed-preset-btn ${isSelected ? "is-active" : ""}`}
                    onClick={() => handleSpeedPresetSelect(preset.name)}
                    title={t(`equalizer.presets.${preset.name}.description` as never, { defaultValue: preset.description })}
                    aria-pressed={isSelected}
                  >
                    <span className="speed-preset-btn__name">
                      {t(`equalizer.presets.${preset.name}.name` as never, { defaultValue: preset.name })}
                    </span>
                    <span className="speed-preset-btn__meta">
                      {preset.playbackRate.toFixed(2)}×
                    </span>
                  </button>
                );
              })}
              <span
                className={`speed-preset-chip-custom ${
                  activeSpeedPreset === "Custom" ? "is-active" : ""
                }`}
                aria-current={activeSpeedPreset === "Custom" ? "true" : undefined}
              >
                {t("equalizer.custom")}
              </span>
            </div>

            {/* Slider + Numeric Input + Preserve Pitch + Reset */}
            <div className="speed-controls-grid">
              <div className="speed-slider-col">
                <input
                  type="range"
                  min={MIN_PLAYBACK_RATE}
                  max={MAX_PLAYBACK_RATE}
                  step={PLAYBACK_RATE_STEP}
                  value={playbackRate}
                  className="speed-range-slider"
                  onChange={(e) => handleSpeedSliderChange(Number(e.target.value))}
                  aria-label={t("equalizer.sliderAria")}
                />
                <div className="speed-slider-ticks">
                  {SPEED_SCALE_TICKS.map((tick) => (
                    <button
                      key={tick}
                      type="button"
                      className={`speed-tick-btn ${
                        Math.abs(playbackRate - tick) < 0.005 ? "is-active" : ""
                      }`}
                      onClick={() => handleSpeedSliderChange(tick)}
                    >
                      {tick.toFixed(2)}×
                    </button>
                  ))}
                </div>
              </div>

              <div className="speed-actions-col">
                <div className="speed-number-field">
                  <label htmlFor="playback-speed-input">{t("equalizer.exactSpeed")}</label>
                  <div className="speed-number-input-wrap">
                    <input
                      id="playback-speed-input"
                      type="number"
                      min={MIN_PLAYBACK_RATE}
                      max={MAX_PLAYBACK_RATE}
                      step={PLAYBACK_RATE_STEP}
                      value={displayedSpeedText}
                      onChange={(e) => setEditingSpeedText(e.target.value)}
                      onBlur={commitNumericSpeedInput}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          commitNumericSpeedInput();
                        }
                      }}
                      aria-label={t("equalizer.exactSpeed")}
                    />
                    <span className="speed-number-unit">×</span>
                  </div>
                </div>

                <label className="eq-toggle speed-pitch-toggle">
                  <input
                    type="checkbox"
                    checked={preservePitch}
                    onChange={(e) =>
                      setPlaybackSpeed({ preservePitch: e.target.checked })
                    }
                    aria-label={t("equalizer.preservePitchAria")}
                  />
                  <span>{t("equalizer.preservePitch")}</span>
                </label>

                <button
                  type="button"
                  className="settings-button settings-button--secondary"
                  onClick={resetPlaybackSpeed}
                  title={t("equalizer.resetSpeedTitle")}
                >
                  <RotateCcw size={13} />
                  {t("equalizer.resetSpeed")}
                </button>
              </div>
            </div>
          </section>

          {/* Equalizer Toolbar */}
          <div className="eq-toolbar">
            <label className="eq-toggle">
              <input
                type="checkbox"
                checked={equalizerEnabled}
                onChange={(e) => setEqualizerEnabled(e.target.checked)}
              />
              <span>{t("equalizer.enableEq")}</span>
            </label>

            <div className="eq-toolbar__actions">
              <select
                value={equalizerPreset}
                onChange={(e) => applyEqPreset(e.target.value)}
                aria-label={t("equalizer.eqPresetAria")}
              >
                {Object.keys(EQUALIZER_PRESETS).map((presetName) => (
                  <option key={presetName} value={presetName}>
                    {t(`equalizer.eqPresets.${presetName}` as never, { defaultValue: presetName })}
                  </option>
                ))}
                <option value="Custom">{t("equalizer.custom")}</option>
              </select>

              <button
                type="button"
                className="settings-button settings-button--secondary"
                onClick={() => {
                  setEqualizerPreset("Flat");
                  setEqualizerBands([...DEFAULT_EQUALIZER_BANDS]);
                }}
              >
                {t("equalizer.resetEq")}
              </button>
            </div>
          </div>

          <div className="eq-panel">
            <div className="eq-panel__header">
              <div className="eq-panel__label">
                <SlidersHorizontal size={14} />
                <span>{t("equalizer.bandResponse")}</span>
              </div>
            </div>

            <div className="eq-visualizer">
              <div className="eq-scale">
                {EQ_SCALE_MARKS.filter((v) => v % 3 === 0)
                  .reverse()
                  .map((value) => (
                    <div
                      key={value}
                      className="eq-scale__label"
                      style={
                        {
                          "--f": (EQ_MAX - value) / (EQ_MAX - EQ_MIN),
                        } as React.CSSProperties
                      }
                    >
                      {value > 0 ? "+" : ""}
                      {value}
                    </div>
                  ))}
              </div>

              <div className="eq-grid">
                <div className="eq-grid__guides">
                  {EQ_SCALE_MARKS.map((value) => (
                    <div
                      key={value}
                      className={`eq-grid__guide ${
                        value === 0
                          ? "eq-grid__guide--zero"
                          : value % 3 === 0
                            ? "eq-grid__guide--major"
                            : ""
                      }`}
                      style={
                        {
                          "--f": (EQ_MAX - value) / (EQ_MAX - EQ_MIN),
                        } as React.CSSProperties
                      }
                    />
                  ))}
                </div>

                {equalizerBands.map((gain, index) => (
                  <div key={EQUALIZER_BANDS[index]} className="eq-band">
                    <div
                      className={`eq-band__value ${
                        gain > 0
                          ? "eq-band__value--positive"
                          : gain < 0
                            ? "eq-band__value--negative"
                            : ""
                      }`}
                    >
                      {gain > 0 ? "+" : ""}
                      {gain}
                    </div>
                    <div className="eq-band__slider-wrap">
                      <input
                        type="range"
                        min={EQ_MIN}
                        max={EQ_MAX}
                        step={EQ_STEP}
                        value={gain}
                        className="eq-band__slider"
                        onChange={(e) =>
                          updateBand(index, Number(e.target.value))
                        }
                        disabled={!equalizerEnabled}
                        aria-label={t("equalizer.bandAria", { freq: EQUALIZER_BANDS[index] })}
                      />
                    </div>
                    <div className="eq-band__freq">
                      {EQUALIZER_BANDS[index]} Hz
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="settings-actions">
            <button
              type="button"
              className="settings-button settings-button--primary"
              onClick={handleSaveSettings}
              disabled={savingSettings}
            >
              {savingSettings ? t("saving") : t("saveSettings")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
