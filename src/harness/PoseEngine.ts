import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { smoothLandmarks } from './kinematics';
import type { PoseFrame, ScreenLandmark, WorldLandmark } from './types';

export interface PoseEngineOptions {
  /** Landmark smoothing factor, 0..1. Lower is smoother but laggier. */
  smoothing?: number;
  minPoseDetectionConfidence?: number;
  minTrackingConfidence?: number;
}

export type PoseListener = (frame: PoseFrame, inferenceMs: number) => void;

/**
 * Owns the webcam stream, the MediaPipe pose detector and the capture loop.
 * Emits one PoseFrame per rendered video frame; a frame with empty landmark
 * arrays means no subject is currently tracked.
 */
export class PoseEngine {
  private landmarker: PoseLandmarker | null = null;
  private stream: MediaStream | null = null;
  private rafId = 0;
  private lastVideoTime = -1;
  private running = false;
  private listeners = new Set<PoseListener>();
  private smoothedScreen: ScreenLandmark[] | null = null;
  private smoothedWorld: WorldLandmark[] | null = null;
  private readonly opts: Required<PoseEngineOptions>;

  readonly video: HTMLVideoElement;

  constructor(video: HTMLVideoElement, opts: PoseEngineOptions = {}) {
    this.video = video;
    this.opts = {
      smoothing: opts.smoothing ?? 0.55,
      minPoseDetectionConfidence: opts.minPoseDetectionConfidence ?? 0.5,
      minTrackingConfidence: opts.minTrackingConfidence ?? 0.5,
    };
  }

  onFrame(fn: PoseListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  async start(): Promise<void> {
    if (this.running) return;

    const fileset = await FilesetResolver.forVisionTasks(`${import.meta.env.BASE_URL}mediapipe/wasm`);
    this.landmarker = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: `${import.meta.env.BASE_URL}models/pose_landmarker_full.task`,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: this.opts.minPoseDetectionConfidence,
      minTrackingConfidence: this.opts.minTrackingConfidence,
      outputSegmentationMasks: false,
    });

    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: false,
    });
    this.video.srcObject = this.stream;
    await this.video.play();

    this.running = true;
    this.loop();
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.landmarker?.close();
    this.landmarker = null;
    this.smoothedScreen = null;
    this.smoothedWorld = null;
    this.lastVideoTime = -1;
  }

  private loop = (): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);

    const video = this.video;
    const landmarker = this.landmarker;
    if (!landmarker || video.readyState < 2 || video.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = video.currentTime;

    const t0 = performance.now();
    const result = landmarker.detectForVideo(video, t0);
    const inferenceMs = performance.now() - t0;

    const rawScreen = (result.landmarks[0] ?? []) as ScreenLandmark[];
    const rawWorld = (result.worldLandmarks[0] ?? []) as WorldLandmark[];

    if (rawScreen.length === 0) {
      this.smoothedScreen = null;
      this.smoothedWorld = null;
    } else {
      this.smoothedScreen = smoothLandmarks(this.smoothedScreen, rawScreen, this.opts.smoothing);
      this.smoothedWorld = smoothLandmarks(this.smoothedWorld, rawWorld, this.opts.smoothing);
    }

    const frame: PoseFrame = {
      t: t0,
      screen: this.smoothedScreen ?? [],
      world: this.smoothedWorld ?? [],
    };
    this.listeners.forEach((fn) => fn(frame, inferenceMs));
  };
}
