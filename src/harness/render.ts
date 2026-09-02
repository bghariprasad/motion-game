import { FaceLandmarker } from '@mediapipe/tasks-vision';
import { jointFrames } from './kinematics';
import { BONES, FINGER_TIPS, GREEN_JOINTS, HAND_BONES, H, JOINT_DOTS, L } from './landmarks';
import type { FaceLandmarks, HandLandmarks, PoseFrame, Vec3 } from './types';

export interface RenderOptions {
  mirrored: boolean;
  showVideo: boolean;
  showFrames: boolean;
  showBones: boolean;
  showHands: boolean;
  showFace: boolean;
}

const AXIS_COLORS = ['#ff2020', '#20d020', '#2050ff'] as const;

/**
 * Maps the video's normalized landmark space onto the canvas using the same
 * contain-fit the <video> element uses, so the overlay stays registered with
 * the picture at any container aspect ratio.
 */
function fit(canvasW: number, canvasH: number, videoW: number, videoH: number) {
  const s = Math.min(canvasW / videoW, canvasH / videoH);
  const w = videoW * s;
  const h = videoH * s;
  return { ox: (canvasW - w) / 2, oy: (canvasH - h) / 2, w, h };
}

function arrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dx: number,
  dy: number,
  color: string,
): void {
  const l = Math.hypot(dx, dy);
  if (l < 1) return;
  const ux = dx / l;
  const uy = dy / l;
  const tipX = x + dx;
  const tipY = y + dy;
  const head = Math.min(8, l * 0.4);

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(tipX - ux * head * 0.6, tipY - uy * head * 0.6);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX - ux * head - uy * head * 0.45, tipY - uy * head + ux * head * 0.45);
  ctx.lineTo(tipX - ux * head + uy * head * 0.45, tipY - uy * head - ux * head * 0.45);
  ctx.closePath();
  ctx.fill();
}

/** Draws the fixed world reference frame, labelled F^T as in the reference figure. */
function drawWorldFrame(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  arrow(ctx, x, y, size, 0, AXIS_COLORS[0]);
  arrow(ctx, x, y, 0, -size, AXIS_COLORS[1]);
  arrow(ctx, x, y, -size * 0.6, size * 0.6, AXIS_COLORS[2]);
  ctx.fillStyle = '#e8e8e8';
  ctx.font = 'italic 16px Georgia, serif';
  ctx.fillText('F', x - size - 26, y - 4);
  ctx.font = 'italic 11px Georgia, serif';
  ctx.fillText('T', x - size - 15, y - 12);
}

interface Box {
  ox: number;
  oy: number;
  w: number;
  h: number;
}

/**
 * Hands are drawn at a finer scale than the body: thin bones, small dots,
 * fingertips picked out in cyan so pinch and grab gestures stay readable.
 */
function drawHand(
  ctx: CanvasRenderingContext2D,
  hand: HandLandmarks,
  box: Box,
  mirrored: boolean,
): void {
  const lms = hand.screen;
  if (lms.length === 0) return;
  const hx = (i: number) => box.ox + (mirrored ? 1 - lms[i].x : lms[i].x) * box.w;
  const hy = (i: number) => box.oy + lms[i].y * box.h;

  ctx.strokeStyle = '#101010';
  ctx.lineWidth = Math.max(2, box.w * 0.003);
  ctx.lineCap = 'round';
  for (const [a, b] of HAND_BONES) {
    ctx.beginPath();
    ctx.moveTo(hx(a), hy(a));
    ctx.lineTo(hx(b), hy(b));
    ctx.stroke();
  }

  const tips = new Set(FINGER_TIPS);
  const r = Math.max(2.5, box.w * 0.004);
  ctx.lineWidth = 1.2;
  for (let i = 0; i < lms.length; i++) {
    ctx.fillStyle = i === H.wrist ? '#22c522' : tips.has(i) ? '#2ce8e0' : '#ffe11a';
    ctx.beginPath();
    ctx.arc(hx(i), hy(i), i === H.wrist ? r * 1.5 : r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.fillStyle = '#e8e8e8';
  ctx.font = '11px ui-monospace, monospace';
  ctx.fillText(hand.handedness[0], hx(H.wrist) + r * 2.5, hy(H.wrist) - r * 2);
}

/**
 * Contours only, never the full tesselation: the mesh's ~2600 triangles would
 * bury the skeleton, and the feature outlines are what expression reads from.
 */
const FACE_CONTOURS: Array<{ connections: Array<{ start: number; end: number }>; color: string; width: number }> = [
  { connections: FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, color: '#f0f0f0', width: 1.6 },
  { connections: FaceLandmarker.FACE_LANDMARKS_LIPS, color: '#ff7a9c', width: 1.6 },
  { connections: FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, color: '#2ce8e0', width: 1.4 },
  { connections: FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, color: '#2ce8e0', width: 1.4 },
  { connections: FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW, color: '#ffe11a', width: 1.6 },
  { connections: FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW, color: '#ffe11a', width: 1.6 },
  { connections: FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS, color: '#4da3ff', width: 1.4 },
  { connections: FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS, color: '#4da3ff', width: 1.4 },
];

function drawFace(
  ctx: CanvasRenderingContext2D,
  face: FaceLandmarks,
  box: Box,
  mirrored: boolean,
): void {
  const lms = face.screen;
  if (lms.length === 0) return;
  const fx = (i: number) => box.ox + (mirrored ? 1 - lms[i].x : lms[i].x) * box.w;
  const fy = (i: number) => box.oy + lms[i].y * box.h;

  for (const { connections, color, width } of FACE_CONTOURS) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (const c of connections) {
      if (c.start >= lms.length || c.end >= lms.length) continue;
      ctx.moveTo(fx(c.start), fy(c.start));
      ctx.lineTo(fx(c.end), fy(c.end));
    }
    ctx.stroke();
  }
}

export function renderPose(
  ctx: CanvasRenderingContext2D,
  frame: PoseFrame,
  videoW: number,
  videoH: number,
  opts: RenderOptions,
): void {
  const { width: cw, height: ch } = ctx.canvas;
  ctx.clearRect(0, 0, cw, ch);

  if (!opts.showVideo) {
    ctx.fillStyle = '#0b0d10';
    ctx.fillRect(0, 0, cw, ch);
  }

  const box = fit(cw, ch, videoW, videoH);
  drawWorldFrame(ctx, 56, ch - 40, 34);

  const lms = frame.screen;
  const hasPose = lms.length > 0;

  const px = (i: number) => box.ox + (opts.mirrored ? 1 - lms[i].x : lms[i].x) * box.w;
  const py = (i: number) => box.oy + lms[i].y * box.h;

  if (hasPose && opts.showBones) {
    ctx.strokeStyle = '#101010';
    ctx.lineWidth = Math.max(4, box.w * 0.008);
    ctx.lineCap = 'round';
    for (const [a, b] of BONES) {
      ctx.beginPath();
      ctx.moveTo(px(a), py(a));
      ctx.lineTo(px(b), py(b));
      ctx.stroke();
    }
    // Neck: head down to the midpoint of the shoulder line.
    const nx = (px(L.leftShoulder) + px(L.rightShoulder)) / 2;
    const ny = (py(L.leftShoulder) + py(L.rightShoulder)) / 2;
    ctx.beginPath();
    ctx.moveTo(px(L.nose), py(L.nose));
    ctx.lineTo(nx, ny);
    ctx.stroke();
  }

  if (hasPose && opts.showFrames && frame.world.length > 0) {
    // Axis length in pixels; world axes are unit vectors so this is pure scale.
    const axisLen = Math.max(22, box.w * 0.045);
    const sx = opts.mirrored ? -1 : 1;
    const project = (v: Vec3) => ({ dx: v.x * axisLen * sx, dy: v.y * axisLen });

    for (const f of jointFrames(frame.world)) {
      const x = px(f.joint);
      const y = py(f.joint);
      const axes = [f.x, f.y, f.z];
      for (let i = 0; i < 3; i++) {
        const { dx, dy } = project(axes[i]);
        arrow(ctx, x, y, dx, dy, AXIS_COLORS[i]);
      }
    }
  }

  if (opts.showFace && frame.face) drawFace(ctx, frame.face, box, opts.mirrored);

  if (opts.showHands) {
    for (const hand of frame.hands) drawHand(ctx, hand, box, opts.mirrored);
  }

  if (!hasPose) return;

  const r = Math.max(5, box.w * 0.009);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#101010';
  for (const i of JOINT_DOTS) {
    ctx.fillStyle = GREEN_JOINTS.has(i) ? '#22c522' : '#ffe11a';
    ctx.beginPath();
    ctx.arc(px(i), py(i), r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}
