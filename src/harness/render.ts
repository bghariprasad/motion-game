import { jointFrames } from './kinematics';
import { BONES, GREEN_JOINTS, JOINT_DOTS, L } from './landmarks';
import type { PoseFrame, Vec3 } from './types';

export interface RenderOptions {
  mirrored: boolean;
  showVideo: boolean;
  showFrames: boolean;
  showBones: boolean;
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
  if (lms.length === 0) return;

  const px = (i: number) => box.ox + (opts.mirrored ? 1 - lms[i].x : lms[i].x) * box.w;
  const py = (i: number) => box.oy + lms[i].y * box.h;

  if (opts.showBones) {
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

  if (opts.showFrames && frame.world.length > 0) {
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
