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

export interface PoseFrame {
  /** performance.now() at capture time. */
  t: number;
  screen: ScreenLandmark[];
  world: WorldLandmark[];
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
}
