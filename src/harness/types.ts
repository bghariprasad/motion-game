export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** A landmark in normalized image space (0..1), plus depth and confidence. */
export interface ScreenLandmark extends Vec3 {
  visibility: number;
}

/** A landmark in metric world space, origin at the hip midpoint, units in meters. */
export interface WorldLandmark extends Vec3 {
  visibility: number;
}

/** One orthonormal coordinate frame attached to a joint. */
export interface JointFrame {
  /** Landmark index this frame is anchored to. */
  joint: number;
  /** Unit basis vectors in world space. Drawn red / green / blue respectively. */
  x: Vec3;
  y: Vec3;
  z: Vec3;
}

export type Handedness = 'Left' | 'Right';

/** One detected hand. `world` is hand-local: origin at the hand's centre, in metres. */
export interface HandLandmarks {
  handedness: Handedness;
  score: number;
  screen: ScreenLandmark[];
  world: WorldLandmark[];
}

export interface Blendshape {
  name: string;
  /** 0..1 activation. */
  score: number;
}

export interface FaceLandmarks {
  /** 478 landmarks in normalized image space. */
  screen: ScreenLandmark[];
  blendshapes: Blendshape[];
  /** Flattened 4x4 facial transformation matrix, column-major. Null when unavailable. */
  matrix: number[] | null;
}

export interface PoseFrame {
  /** performance.now() at capture time. */
  t: number;
  screen: ScreenLandmark[];
  world: WorldLandmark[];
  /** Empty when hand tracking is disabled or no hand is in view. */
  hands: HandLandmarks[];
  /** Null when face tracking is disabled or no face is in view. */
  face: FaceLandmarks | null;
}

export interface JointAngle {
  name: string;
  /** Interior angle at the joint, in degrees. */
  deg: number;
  /** Minimum visibility across the three landmarks forming the angle. */
  confidence: number;
}

export interface PointVelocity {
  name: string;
  /** Metres per second. */
  speed: number;
  vec: Vec3;
}

export interface FingerState {
  name: string;
  /** Interior angle at the finger's middle joint, in degrees. 180 is straight. */
  curlDeg: number;
  /** 0 fully extended, 1 fully closed. Derived from curlDeg. */
  closed: number;
}

export interface HandTelemetry {
  handedness: Handedness;
  score: number;
  fingers: FingerState[];
  /** Thumb tip to index tip distance, in metres. */
  pinch: number;
  /** Index tip to pinky tip distance, in metres. */
  spread: number;
  /**
   * Mean fingertip speed in the hand's own frame, in metres per second, so
   * moving the whole arm does not register as finger movement.
   */
  fingerMotion: number;
}

export interface ExpressionState {
  name: string;
  /** 0..1 activation. */
  score: number;
}

/** Head orientation in degrees. Yaw turns left/right, pitch nods, roll tilts. */
export interface HeadPose {
  yaw: number;
  pitch: number;
  roll: number;
}

export interface FaceTelemetry {
  expressions: ExpressionState[];
  /** The strongest raw blendshapes, strongest first, for inspecting the source signal. */
  top: Blendshape[];
  /** Coarse label: happy, surprised, angry, sad, or neutral. */
  mood: string;
  /** Confidence in `mood`; zero when neutral. */
  moodScore: number;
  blinkLeft: number;
  blinkRight: number;
  head: HeadPose;
}

export interface Telemetry {
  fps: number;
  /** Milliseconds spent inside the pose detector for the last frame. */
  inferenceMs: number;
  tracked: boolean;
  angles: JointAngle[];
  velocities: PointVelocity[];
  /** Aggregate whole-body movement, in metres per second. */
  motionEnergy: number;
  /** Signed torso tilt from vertical, in degrees. Positive leans to the subject's left. */
  torsoLeanDeg: number;
  /** Hip-midpoint height above the ankle midpoint, in metres. */
  hipHeight: number;
  /** One entry per tracked hand; empty when hand tracking is off. */
  hands: HandTelemetry[];
  /** Null when face tracking is off or no face is in view. */
  face: FaceTelemetry | null;
}
