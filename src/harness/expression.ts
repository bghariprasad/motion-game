import type { Blendshape, ExpressionState, FaceLandmarks, FaceTelemetry, HeadPose } from './types';

/** Blendshape lookup, tolerant of names the model does not emit. */
const score = (b: Map<string, number>, name: string): number => b.get(name) ?? 0;
const avg = (b: Map<string, number>, ...names: string[]): number =>
  names.reduce((s, n) => s + score(b, n), 0) / names.length;

/**
 * Composite expressions, each built from the ARKit-style blendshapes MediaPipe
 * emits. Left/right in blendshape names is from the subject's point of view.
 */
const EXPRESSIONS: Array<[string, (b: Map<string, number>) => number]> = [
  ['smile', (b) => avg(b, 'mouthSmileLeft', 'mouthSmileRight')],
  ['frown', (b) => avg(b, 'mouthFrownLeft', 'mouthFrownRight')],
  ['jaw open', (b) => score(b, 'jawOpen')],
  ['brow raise', (b) => avg(b, 'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight')],
  ['brow furrow', (b) => avg(b, 'browDownLeft', 'browDownRight')],
  ['squint', (b) => avg(b, 'eyeSquintLeft', 'eyeSquintRight')],
  ['pucker', (b) => Math.max(score(b, 'mouthPucker'), score(b, 'mouthFunnel'))],
  ['cheek puff', (b) => score(b, 'cheekPuff')],
  ['sneer', (b) => avg(b, 'noseSneerLeft', 'noseSneerRight')],
];

/**
 * Coarse emotion labels. Each is a product of its parts, so a label only fires
 * when every component is present — this keeps a wide-open mouth alone from
 * reading as surprise.
 */
const MOODS: Array<[string, (b: Map<string, number>) => number]> = [
  ['happy', (b) => avg(b, 'mouthSmileLeft', 'mouthSmileRight')],
  [
    'surprised',
    (b) =>
      Math.sqrt(score(b, 'jawOpen') * avg(b, 'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight')),
  ],
  [
    'angry',
    (b) => Math.sqrt(avg(b, 'browDownLeft', 'browDownRight') * avg(b, 'mouthPressLeft', 'mouthPressRight')),
  ],
  ['sad', (b) => Math.sqrt(avg(b, 'mouthFrownLeft', 'mouthFrownRight') * score(b, 'browInnerUp'))],
];

/** Below this, no mood is confident enough to name and the face reads as neutral. */
const MOOD_THRESHOLD = 0.25;

/**
 * Head orientation from the 4x4 facial transformation matrix, in degrees.
 * The matrix is column-major, so the rotation basis is at indices 0..2, 4..6, 8..10.
 */
export function headPose(matrix: number[] | null): HeadPose {
  if (!matrix || matrix.length < 12) return { yaw: 0, pitch: 0, roll: 0 };
  const [r00, r10, r20, , , r11, r21, , , r12, r22] = matrix;
  const deg = 180 / Math.PI;
  const sy = Math.sqrt(r00 * r00 + r10 * r10);
  // Gimbal lock: with the face pitched near vertical, yaw and roll degenerate.
  if (sy < 1e-6) {
    return { yaw: 0, pitch: Math.atan2(-r20, sy) * deg, roll: Math.atan2(-r12, r11) * deg };
  }
  return {
    yaw: Math.atan2(r10, r00) * deg,
    pitch: Math.atan2(-r20, sy) * deg,
    roll: Math.atan2(r21, r22) * deg,
  };
}

export function faceTelemetry(face: FaceLandmarks): FaceTelemetry {
  const b = new Map(face.blendshapes.map((s) => [s.name, s.score]));

  const expressions: ExpressionState[] = EXPRESSIONS.map(([name, fn]) => ({
    name,
    score: Math.min(1, Math.max(0, fn(b))),
  }));

  let mood = 'neutral';
  let moodScore = MOOD_THRESHOLD;
  for (const [name, fn] of MOODS) {
    const s = fn(b);
    if (s > moodScore) {
      mood = name;
      moodScore = s;
    }
  }

  return {
    expressions,
    top: topBlendshapes(face, 5),
    mood,
    moodScore: mood === 'neutral' ? 0 : moodScore,
    blinkLeft: score(b, 'eyeBlinkLeft'),
    blinkRight: score(b, 'eyeBlinkRight'),
    head: headPose(face.matrix),
  };
}

/** The strongest raw blendshapes, for the debug list. Excludes the `_neutral` catch-all. */
export function topBlendshapes(face: FaceLandmarks, n: number): Blendshape[] {
  return face.blendshapes
    .filter((s) => s.name !== '_neutral' && s.score > 0.02)
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}
