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

      {t.face && (
        <>
          <h3>Expression</h3>
          <div className="hand">
            <div className="hand-head">
              <span className="mood">{t.face.mood}</span>
              <span className="muted">
                {t.face.moodScore > 0 ? `${fmt(t.face.moodScore * 100, 0)}%` : '\u2014'}
              </span>
            </div>
            <table>
              <tbody>
                {t.face.expressions.map((e) => (
                  <tr key={e.name}>
                    <td className="k wide">{e.name}</td>
                    <td className="v">{fmt(e.score * 100, 0)}</td>
                    <td className="track">
                      <i className="warm" style={{ width: `${e.score * 100}%` }} />
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="k wide">blink L / R</td>
                  <td className="v">
                    {fmt(t.face.blinkLeft * 100, 0)}/{fmt(t.face.blinkRight * 100, 0)}
                  </td>
                  <td className="track">
                    <i
                      className="cool"
                      style={{ width: `${Math.max(t.face.blinkLeft, t.face.blinkRight) * 100}%` }}
                    />
                  </td>
                </tr>
              </tbody>
            </table>
            {t.face.top.length > 0 && (
              <div className="signals">
                {t.face.top.map((s) => (
                  <span key={s.name} title={`${fmt(s.score * 100, 0)}%`}>
                    {s.name} <b>{fmt(s.score * 100, 0)}</b>
                  </span>
                ))}
              </div>
            )}
            <div className="head-pose">
              <span>yaw {fmt(t.face.head.yaw, 0)}&deg;</span>
              <span>pitch {fmt(t.face.head.pitch, 0)}&deg;</span>
              <span>roll {fmt(t.face.head.roll, 0)}&deg;</span>
            </div>
          </div>
        </>
      )}

      {t.hands.length > 0 && <h3>Fingers</h3>}
      {t.hands.map((h) => (
        <div key={h.handedness} className="hand">
          <div className="hand-head">
            <span>{h.handedness} hand</span>
            <span className="muted">
              pinch {fmt(h.pinch * 100, 1)} cm &middot; motion {fmt(h.fingerMotion, 2)}
            </span>
          </div>
          <table>
            <tbody>
              {h.fingers.map((f) => (
                <tr key={f.name}>
                  <td className="k">{f.name}</td>
                  <td className="v">{fmt(f.curlDeg, 0)}&deg;</td>
                  <td className="track">
                    <i className="cool" style={{ width: `${f.closed * 100}%` }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

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
