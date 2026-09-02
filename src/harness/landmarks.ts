/** MediaPipe Pose Landmarker indices, named. */
export const L = {
  nose: 0,
  leftEyeInner: 1,
  leftEye: 2,
  leftEyeOuter: 3,
  rightEyeInner: 4,
  rightEye: 5,
  rightEyeOuter: 6,
  leftEar: 7,
  rightEar: 8,
  mouthLeft: 9,
  mouthRight: 10,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftPinky: 17,
  rightPinky: 18,
  leftIndex: 19,
  rightIndex: 20,
  leftThumb: 21,
  rightThumb: 22,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftHeel: 29,
  rightHeel: 30,
  leftFootIndex: 31,
  rightFootIndex: 32,
} as const;

/** Bones drawn as thick black segments, matching the reference skeleton. */
export const BONES: Array<[number, number]> = [
  [L.leftShoulder, L.rightShoulder],
  [L.leftShoulder, L.leftElbow],
  [L.leftElbow, L.leftWrist],
  [L.rightShoulder, L.rightElbow],
  [L.rightElbow, L.rightWrist],
  [L.leftShoulder, L.leftHip],
  [L.rightShoulder, L.rightHip],
  [L.leftHip, L.rightHip],
  [L.leftHip, L.leftKnee],
  [L.leftKnee, L.leftAnkle],
  [L.rightHip, L.rightKnee],
  [L.rightKnee, L.rightAnkle],
  [L.leftAnkle, L.leftFootIndex],
  [L.rightAnkle, L.rightFootIndex],
];

/**
 * Joints drawn green in the reference image: the proximal, torso-anchored ones.
 * Everything else in JOINT_DOTS is drawn yellow.
 */
export const GREEN_JOINTS = new Set<number>([
  L.leftShoulder,
  L.rightShoulder,
  L.leftHip,
  L.rightHip,
]);

export const JOINT_DOTS: number[] = [
  L.nose,
  L.leftShoulder,
  L.rightShoulder,
  L.leftElbow,
  L.rightElbow,
  L.leftWrist,
  L.rightWrist,
  L.leftHip,
  L.rightHip,
  L.leftKnee,
  L.rightKnee,
  L.leftAnkle,
  L.rightAnkle,
];
