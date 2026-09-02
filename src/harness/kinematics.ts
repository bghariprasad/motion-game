import { faceTelemetry } from './expression';
import { FINGER_CURLS, FINGER_TIPS, H, L } from './landmarks';
import type {
  FingerState,
  HandLandmarks,
  HandTelemetry,
  JointAngle,
  JointFrame,
  PointVelocity,
  PoseFrame,
  Telemetry,
  Vec3,
  WorldLandmark,
} from './types';

export const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const scale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const len = (a: Vec3): number => Math.sqrt(dot(a, a));
export const mid = (a: Vec3, b: Vec3): Vec3 => scale(add(a, b), 0.5);

export const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

export function norm(a: Vec3): Vec3 {
  const l = len(a);
  return l < 1e-6 ? { x: 0, y: 0, z: 0 } : scale(a, 1 / l);
}

/** Interior angle ABC at vertex B, in degrees. */
export function angleAt(a: Vec3, b: Vec3, c: Vec3): number {
  const u = norm(sub(a, b));
  const v = norm(sub(c, b));
  const d = Math.min(1, Math.max(-1, dot(u, v)));
  return (Math.acos(d) * 180) / Math.PI;
}

/**
 * Build an orthonormal frame at `joint`, given the bone arriving from `parent`
 * and the bone continuing to `child`. X (red) runs along the distal bone,
 * Z (blue) is the axis the joint hinges about, Y (green) completes the triad.
 */
function limbFrame(joint: number, lms: WorldLandmark[], parent: number, child: number): JointFrame {
  const p = lms[parent];
  const j = lms[joint];
  const c = lms[child];
  const x = norm(sub(c, j));
  const inbound = norm(sub(j, p));
  let z = cross(inbound, x);
  // A fully extended limb is degenerate: fall back to the world up axis.
  if (len(z) < 1e-3) z = cross({ x: 0, y: -1, z: 0 }, x);
  z = norm(z);
  const y = norm(cross(z, x));
  return { joint, x, y, z };
}

/** Frame for a chain endpoint (wrist, ankle), which has no child bone. */
function endFrame(joint: number, lms: WorldLandmark[], parent: number, grandparent: number): JointFrame {
  const g = lms[grandparent];
  const p = lms[parent];
  const j = lms[joint];
  const x = norm(sub(j, p));
  let z = cross(norm(sub(p, g)), x);
  if (len(z) < 1e-3) z = cross({ x: 0, y: -1, z: 0 }, x);
  z = norm(z);
  const y = norm(cross(z, x));
  return { joint, x, y, z };
}

/**
 * Root frame at the pelvis: X (red) points to the subject's right along the hip
 * line, Y (green) points up the spine, Z (blue) points out of the chest.
 */
function rootFrame(joint: number, lms: WorldLandmark[]): JointFrame {
  const hips = mid(lms[L.leftHip], lms[L.rightHip]);
  const shoulders = mid(lms[L.leftShoulder], lms[L.rightShoulder]);
  const x = norm(sub(lms[L.rightHip], lms[L.leftHip]));
  const upRaw = sub(shoulders, hips);
  const z = norm(cross(x, upRaw));
  const y = norm(cross(z, x));
  return { joint, x, y, z };
}

/** The pelvis frame drawn twice in the reference: once at the hips, once at the chest. */
export function jointFrames(lms: WorldLandmark[]): JointFrame[] {
  const pelvis = rootFrame(L.leftHip, lms);
  return [
    limbFrame(L.leftElbow, lms, L.leftShoulder, L.leftWrist),
    limbFrame(L.rightElbow, lms, L.rightShoulder, L.rightWrist),
    endFrame(L.leftWrist, lms, L.leftElbow, L.leftShoulder),
    endFrame(L.rightWrist, lms, L.rightElbow, L.rightShoulder),
    limbFrame(L.leftKnee, lms, L.leftHip, L.leftAnkle),
    limbFrame(L.rightKnee, lms, L.rightHip, L.rightAnkle),
    endFrame(L.leftAnkle, lms, L.leftKnee, L.leftHip),
    endFrame(L.rightAnkle, lms, L.rightKnee, L.rightHip),
    { ...pelvis, joint: L.leftHip },
    { ...pelvis, joint: L.rightHip },
    { ...pelvis, joint: L.leftShoulder },
  ];
}

const ANGLE_SPECS: Array<[string, number, number, number]> = [
  ['L elbow', L.leftShoulder, L.leftElbow, L.leftWrist],
  ['R elbow', L.rightShoulder, L.rightElbow, L.rightWrist],
  ['L shoulder', L.leftElbow, L.leftShoulder, L.leftHip],
  ['R shoulder', L.rightElbow, L.rightShoulder, L.rightHip],
  ['L hip', L.leftShoulder, L.leftHip, L.leftKnee],
  ['R hip', L.rightShoulder, L.rightHip, L.rightKnee],
  ['L knee', L.leftHip, L.leftKnee, L.leftAnkle],
  ['R knee', L.rightHip, L.rightKnee, L.rightAnkle],
];

const VELOCITY_POINTS: Array<[string, number]> = [
  ['L wrist', L.leftWrist],
  ['R wrist', L.rightWrist],
  ['L elbow', L.leftElbow],
  ['R elbow', L.rightElbow],
  ['L knee', L.leftKnee],
  ['R knee', L.rightKnee],
  ['L ankle', L.leftAnkle],
  ['R ankle', L.rightAnkle],
];

/** A finger reads fully extended near 180 degrees and fully closed near 90. */
function closedness(curlDeg: number): number {
  return Math.min(1, Math.max(0, (180 - curlDeg) / 90));
}

/**
 * Per-hand finger state. Fingertip motion is measured in hand-local world
 * coordinates, so it isolates finger movement from arm movement.
 */
function handTelemetry(hand: HandLandmarks, prev: HandLandmarks | undefined, dt: number): HandTelemetry {
  const w = hand.world;
  const fingers: FingerState[] = FINGER_CURLS.map(([name, a, b, c]) => {
    const curlDeg = angleAt(w[a], w[b], w[c]);
    return { name, curlDeg, closed: closedness(curlDeg) };
  });

  let fingerMotion = 0;
  if (prev && prev.world.length === w.length && dt > 1e-3 && dt < 0.5) {
    for (const i of FINGER_TIPS) {
      fingerMotion += len(sub(w[i], prev.world[i])) / dt;
    }
    fingerMotion /= FINGER_TIPS.length;
  }

  return {
    handedness: hand.handedness,
    score: hand.score,
    fingers,
    pinch: len(sub(w[H.thumbTip], w[H.indexTip])),
    spread: len(sub(w[H.indexTip], w[H.pinkyTip])),
    fingerMotion,
  };
}

/**
 * Derives angles, velocities and posture scalars. Velocities are finite
 * differences against the previous frame, so `prev` must be the immediately
 * preceding capture; a missing or stale `prev` yields zero velocity.
 */
export function computeTelemetry(
  frame: PoseFrame,
  prev: PoseFrame | null,
  fps: number,
  inferenceMs: number,
): Telemetry {
  const w = frame.world;
  if (w.length === 0) {
    return {
      fps,
      inferenceMs,
      tracked: false,
      angles: [],
      velocities: [],
      motionEnergy: 0,
      torsoLeanDeg: 0,
      hipHeight: 0,
      hands: handsOf(frame, prev),
      face: frame.face ? faceTelemetry(frame.face) : null,
    };
  }

  const angles: JointAngle[] = ANGLE_SPECS.map(([name, a, b, c]) => ({
    name,
    deg: angleAt(w[a], w[b], w[c]),
    confidence: Math.min(w[a].visibility, w[b].visibility, w[c].visibility),
  }));

  const dt = prev ? (frame.t - prev.t) / 1000 : 0;
  const usable = dt > 1e-3 && dt < 0.5 && prev !== null && prev.world.length > 0;
  const velocities: PointVelocity[] = VELOCITY_POINTS.map(([name, i]) => {
    if (!usable) return { name, speed: 0, vec: { x: 0, y: 0, z: 0 } };
    const vec = scale(sub(w[i], prev!.world[i]), 1 / dt);
    return { name, speed: len(vec), vec };
  });

  let motionEnergy = 0;
  if (usable) {
    for (let i = 0; i < w.length; i++) {
      motionEnergy += len(sub(w[i], prev!.world[i])) / dt;
    }
    motionEnergy /= w.length;
  }

  const hips = mid(w[L.leftHip], w[L.rightHip]);
  const shoulders = mid(w[L.leftShoulder], w[L.rightShoulder]);
  const spine = sub(shoulders, hips);
  // World Y grows downward, so an upright spine has a negative y component.
  const torsoLeanDeg = (Math.atan2(spine.x, -spine.y) * 180) / Math.PI;
  const ankles = mid(w[L.leftAnkle], w[L.rightAnkle]);

  return {
    fps,
    inferenceMs,
    tracked: true,
    angles,
    velocities,
    motionEnergy,
    torsoLeanDeg,
    hipHeight: ankles.y - hips.y,
    hands: handsOf(frame, prev),
    face: frame.face ? faceTelemetry(frame.face) : null,
  };
}

/** Pairs each hand with the same hand in the previous frame, matched by handedness. */
function handsOf(frame: PoseFrame, prev: PoseFrame | null): HandTelemetry[] {
  const dt = prev ? (frame.t - prev.t) / 1000 : 0;
  return frame.hands.map((h) =>
    handTelemetry(h, prev?.hands.find((p) => p.handedness === h.handedness), dt),
  );
}

/** Exponential smoothing, applied per-axis to suppress landmark jitter. */
export function smoothLandmarks<T extends Vec3 & { visibility: number }>(
  prev: T[] | null,
  next: T[],
  alpha: number,
): T[] {
  if (!prev || prev.length !== next.length) return next;
  return next.map((n, i) => ({
    ...n,
    x: prev[i].x + (n.x - prev[i].x) * alpha,
    y: prev[i].y + (n.y - prev[i].y) * alpha,
    z: prev[i].z + (n.z - prev[i].z) * alpha,
  }));
}
