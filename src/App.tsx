import { useCallback, useEffect, useRef, useState } from 'react';
import { PoseEngine } from './harness/PoseEngine';
import { computeTelemetry } from './harness/kinematics';
import { renderPose, type RenderOptions } from './harness/render';
import type { PoseFrame, Telemetry } from './harness/types';
import { TelemetryPanel } from './components/TelemetryPanel';
import './App.css';

const EMPTY: Telemetry = {
  fps: 0,
  inferenceMs: 0,
  tracked: false,
  angles: [],
  velocities: [],
  motionEnergy: 0,
  torsoLeanDeg: 0,
  hipHeight: 0,
};

/** Telemetry is mirrored into React state at this interval; the canvas still draws every frame. */
const PANEL_HZ = 12;

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PoseEngine | null>(null);
  const prevFrameRef = useRef<PoseFrame | null>(null);
  const fpsRef = useRef(0);
  const lastPanelRef = useRef(0);

  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<Telemetry>(EMPTY);

  const [opts, setOpts] = useState<RenderOptions>({
    mirrored: true,
    showVideo: true,
    showFrames: true,
    showBones: true,
  });
  // The draw loop reads options without re-subscribing on every toggle.
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  }, [opts]);

  const start = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || engineRef.current) return;

    setBusy(true);
    setError(null);
    const engine = new PoseEngine(video);
    engineRef.current = engine;

    engine.onFrame((frame, inferenceMs) => {
      const prev = prevFrameRef.current;
      if (prev) {
        const dt = frame.t - prev.t;
        if (dt > 0) fpsRef.current = fpsRef.current * 0.9 + (1000 / dt) * 0.1;
      }

      const ctx = canvas.getContext('2d');
      if (ctx) {
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = Math.round(rect.width * dpr);
        const h = Math.round(rect.height * dpr);
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        renderPose(ctx, frame, video.videoWidth || 16, video.videoHeight || 9, optsRef.current);
      }

      if (frame.t - lastPanelRef.current > 1000 / PANEL_HZ) {
        lastPanelRef.current = frame.t;
        setTelemetry(computeTelemetry(frame, prev, fpsRef.current, inferenceMs));
      }
      prevFrameRef.current = frame;
    });

    try {
      await engine.start();
      setRunning(true);
    } catch (e) {
      engine.stop();
      engineRef.current = null;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const stop = useCallback(() => {
    engineRef.current?.stop();
    engineRef.current = null;
    prevFrameRef.current = null;
    fpsRef.current = 0;
    setRunning(false);
    setTelemetry(EMPTY);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }, []);

  useEffect(() => () => engineRef.current?.stop(), []);

  const toggle = (key: keyof RenderOptions) => setOpts((o) => ({ ...o, [key]: !o[key] }));

  return (
    <div className="app">
      <header className="topbar">
        <h1>Camera Motion Harness</h1>
        <div className="controls">
          {(['mirrored', 'showVideo', 'showBones', 'showFrames'] as const).map((k) => (
            <label key={k}>
              <input type="checkbox" checked={opts[k]} onChange={() => toggle(k)} />
              {{ mirrored: 'Mirror', showVideo: 'Video', showBones: 'Skeleton', showFrames: 'Frames' }[k]}
            </label>
          ))}
          <button onClick={running ? stop : start} disabled={busy}>
            {busy ? 'Starting…' : running ? 'Stop camera' : 'Start camera'}
          </button>
        </div>
      </header>

      <main className="stage-wrap">
        <div className="stage">
          <video
            ref={videoRef}
            playsInline
            muted
            className={opts.showVideo ? '' : 'hidden'}
            style={{ transform: opts.mirrored ? 'scaleX(-1)' : 'none' }}
          />
          <canvas ref={canvasRef} />
          {!running && !busy && (
            <div className="placeholder">
              <p>{error ? `Camera error: ${error}` : 'Start the camera to map the body.'}</p>
            </div>
          )}
        </div>
        <TelemetryPanel telemetry={telemetry} />
      </main>
    </div>
  );
}
