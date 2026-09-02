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

/** MediaPipe Hand Landmarker indices, named. Same layout on both hands. */
export const H = {
  wrist: 0,
  thumbCmc: 1,
  thumbMcp: 2,
  thumbIp: 3,
  thumbTip: 4,
  indexMcp: 5,
  indexPip: 6,
  indexDip: 7,
  indexTip: 8,
  middleMcp: 9,
  middlePip: 10,
  middleDip: 11,
  middleTip: 12,
  ringMcp: 13,
  ringPip: 14,
  ringDip: 15,
  ringTip: 16,
  pinkyMcp: 17,
  pinkyPip: 18,
  pinkyDip: 19,
  pinkyTip: 20,
} as const;

export const HAND_BONES: Array<[number, number]> = [
  [H.wrist, H.thumbCmc],
  [H.thumbCmc, H.thumbMcp],
  [H.thumbMcp, H.thumbIp],
  [H.thumbIp, H.thumbTip],
  [H.wrist, H.indexMcp],
  [H.indexMcp, H.indexPip],
  [H.indexPip, H.indexDip],
  [H.indexDip, H.indexTip],
  [H.middleMcp, H.middlePip],
  [H.middlePip, H.middleDip],
  [H.middleDip, H.middleTip],
  [H.ringMcp, H.ringPip],
  [H.ringPip, H.ringDip],
  [H.ringDip, H.ringTip],
  [H.wrist, H.pinkyMcp],
  [H.pinkyMcp, H.pinkyPip],
  [H.pinkyPip, H.pinkyDip],
  [H.pinkyDip, H.pinkyTip],
  // The knuckle line closing the palm.
  [H.indexMcp, H.middleMcp],
  [H.middleMcp, H.ringMcp],
  [H.ringMcp, H.pinkyMcp],
];

export const FINGER_TIPS: number[] = [H.thumbTip, H.indexTip, H.middleTip, H.ringTip, H.pinkyTip];

/**
 * Per finger: the three landmarks whose interior angle measures curl, ordered
 * proximal to distal. A straight finger reads near 180 degrees.
 */
export const FINGER_CURLS: Array<[string, number, number, number]> = [
  ['thumb', H.thumbCmc, H.thumbMcp, H.thumbIp],
  ['index', H.indexMcp, H.indexPip, H.indexDip],
  ['middle', H.middleMcp, H.middlePip, H.middleDip],
  ['ring', H.ringMcp, H.ringPip, H.ringDip],
  ['pinky', H.pinkyMcp, H.pinkyPip, H.pinkyDip],
];
