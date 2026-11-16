import { useEffect, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
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

export function EqualizerView() {
  const [equalizerEnabled, setEqualizerEnabled] = useState(false);
  const [equalizerPreset, setEqualizerPreset] = useState("Flat");
  const [equalizerBands, setEqualizerBands] = useState<number[]>(
    DEFAULT_EQUALIZER_BANDS,
  );
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    void window.settings.get().then((settings) => {
      setEqualizerEnabled(settings.equalizerEnabled);
      setEqualizerPreset(settings.equalizerPreset || "Flat");
      setEqualizerBands(
        settings.equalizerBands?.length
          ? settings.equalizerBands
          : DEFAULT_EQUALIZER_BANDS,
      );
    });
  }, []);

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
      });
      await window.playback.setEqualizer(
        equalizerEnabled ? equalizerBands : DEFAULT_EQUALIZER_BANDS,
      );
    } finally {
      setSavingSettings(false);
    }
  }

  function applyPreset(name: string) {
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

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Equalizer</h1>
        <p className="page-subtitle">
          Shape your sound with presets and custom boosts.
        </p>
      </div>

      <div className="page-body eq-page-body">
        <div className="eq-shell">
          <div className="eq-toolbar">
            <label className="eq-toggle">
              <input
                type="checkbox"
                checked={equalizerEnabled}
                onChange={(e) => setEqualizerEnabled(e.target.checked)}
              />
              <span>Enable equalizer</span>
            </label>

            <div className="eq-toolbar__actions">
              <select
                value={equalizerPreset}
                onChange={(e) => applyPreset(e.target.value)}
              >
                {Object.keys(EQUALIZER_PRESETS).map((presetName) => (
                  <option key={presetName} value={presetName}>
                    {presetName}
                  </option>
                ))}
                <option value="Custom">Custom</option>
              </select>

              <button
                type="button"
                className="settings-button settings-button--secondary"
                onClick={() => {
                  setEqualizerPreset("Flat");
                  setEqualizerBands([...DEFAULT_EQUALIZER_BANDS]);
                }}
              >
                Reset
              </button>
            </div>
          </div>

          <div className="eq-panel">
            <div className="eq-panel__header">
              <div className="eq-panel__label">
                <SlidersHorizontal size={14} />
                <span>Band response</span>
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
                        aria-label={`${EQUALIZER_BANDS[index]} Hz band`}
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
              {savingSettings ? "Saving…" : "Save Settings"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
