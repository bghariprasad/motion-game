import type { Telemetry } from '../harness/types';

const fmt = (n: number, d = 1) => n.toFixed(d);

/** Bar width as a percentage, saturating at `max`. */
const bar = (v: number, max: number) => `${Math.min(100, (Math.abs(v) / max) * 100)}%`;

export function TelemetryPanel({ telemetry }: { telemetry: Telemetry }) {
  const t = telemetry;
  return (
    <aside className="panel">
      <header className="panel-head">
        <h2>Telemetry</h2>
        <span className={`status ${t.tracked ? 'on' : 'off'}`}>
          {t.tracked ? 'tracking' : 'no subject'}
        </span>
      </header>

      <section className="stats">
        <div className="stat">
          <span>FPS</span>
          <strong>{fmt(t.fps, 0)}</strong>
        </div>
        <div className="stat">
          <span>Inference</span>
          <strong>{fmt(t.inferenceMs)} ms</strong>
        </div>
        <div className="stat">
          <span>Motion</span>
          <strong>{fmt(t.motionEnergy, 2)} m/s</strong>
        </div>
        <div className="stat">
          <span>Torso lean</span>
          <strong>{fmt(t.torsoLeanDeg, 0)}&deg;</strong>
        </div>
        <div className="stat">
          <span>Hip height</span>
          <strong>{fmt(t.hipHeight, 2)} m</strong>
        </div>
      </section>

      <h3>Joint angles</h3>
      <table>
        <tbody>
          {t.angles.map((a) => (
            <tr key={a.name} className={a.confidence < 0.5 ? 'dim' : undefined}>
              <td className="k">{a.name}</td>
              <td className="v">{fmt(a.deg, 0)}&deg;</td>
              <td className="track">
                <i style={{ width: bar(a.deg, 180) }} />
              </td>
            </tr>
          ))}
          {t.angles.length === 0 && (
            <tr>
              <td colSpan={3} className="empty">
                Step into frame
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h3>Velocities</h3>
      <table>
        <tbody>
          {t.velocities.map((v) => (
            <tr key={v.name}>
              <td className="k">{v.name}</td>
              <td className="v">{fmt(v.speed, 2)}</td>
              <td className="track">
                <i className="hot" style={{ width: bar(v.speed, 3) }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </aside>
  );
}
