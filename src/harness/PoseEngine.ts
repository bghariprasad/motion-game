import {
  FaceLandmarker,
  FilesetResolver,
  HandLandmarker,
  PoseLandmarker,
} from '@mediapipe/tasks-vision';
import { smoothLandmarks } from './kinematics';
import type {
  FaceLandmarks,
  HandLandmarks,
  Handedness,
  PoseFrame,
  ScreenLandmark,
  WorldLandmark,
} from './types';

export interface PoseEngineOptions {
  /** Landmark smoothing factor, 0..1. Lower is smoother but laggier. */
  smoothing?: number;
  minPoseDetectionConfidence?: number;
  minTrackingConfidence?: number;
  /** Load and run the hand detector. Costs roughly a third again per frame. */
  hands?: boolean;
  minHandDetectionConfidence?: number;
  /** Load and run the face detector, including expression blendshapes. */
  face?: boolean;
  minFaceDetectionConfidence?: number;
}

export type PoseListener = (frame: PoseFrame, inferenceMs: number) => void;

/**
 * Owns the webcam stream, the MediaPipe pose detector and the capture loop.
 * Emits one PoseFrame per rendered video frame; a frame with empty landmark
 * arrays means no subject is currently tracked.
 */
export class PoseEngine {
  private landmarker: PoseLandmarker | null = null;
  private handLandmarker: HandLandmarker | null = null;
  private faceLandmarker: FaceLandmarker | null = null;
  private stream: MediaStream | null = null;
  private rafId = 0;
  private lastVideoTime = -1;
  private running = false;
  private listeners = new Set<PoseListener>();
  private smoothedScreen: ScreenLandmark[] | null = null;
  private smoothedWorld: WorldLandmark[] | null = null;
  /** Smoothing carries across frames per hand, keyed by handedness. */
  private smoothedHands = new Map<Handedness, HandLandmarks>();
  private smoothedFace: ScreenLandmark[] | null = null;
  private handsEnabled: boolean;
  private faceEnabled: boolean;
  private fileset: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>> | null = null;
  private readonly opts: Required<PoseEngineOptions>;

  readonly video: HTMLVideoElement;

  constructor(video: HTMLVideoElement, opts: PoseEngineOptions = {}) {
    this.video = video;
    this.opts = {
      smoothing: opts.smoothing ?? 0.55,
      minPoseDetectionConfidence: opts.minPoseDetectionConfidence ?? 0.5,
      minTrackingConfidence: opts.minTrackingConfidence ?? 0.5,
      hands: opts.hands ?? true,
      minHandDetectionConfidence: opts.minHandDetectionConfidence ?? 0.5,
      face: opts.face ?? true,
      minFaceDetectionConfidence: opts.minFaceDetectionConfidence ?? 0.5,
    };
    this.handsEnabled = this.opts.hands;
    this.faceEnabled = this.opts.face;
  }

  onFrame(fn: PoseListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /**
   * Turns finger tracking on or off at runtime. Enabling it lazily loads the
   * hand model on first use; disabling only stops running it, keeping the
   * loaded model so re-enabling is instant.
   */
  async setHandsEnabled(enabled: boolean): Promise<void> {
    this.handsEnabled = enabled;
    if (!enabled) {
      this.smoothedHands.clear();
      return;
    }
    if (!this.handLandmarker && this.fileset) await this.createHandLandmarker();
  }

  /**
   * Turns face and expression tracking on or off at runtime, with the same
   * lazy-load-once semantics as {@link setHandsEnabled}.
   */
  async setFaceEnabled(enabled: boolean): Promise<void> {
    this.faceEnabled = enabled;
    if (!enabled) {
      this.smoothedFace = null;
      return;
    }
    if (!this.faceLandmarker && this.fileset) await this.createFaceLandmarker();
  }

  private async createHandLandmarker(): Promise<void> {
    if (!this.fileset || this.handLandmarker) return;
    this.handLandmarker = await HandLandmarker.createFromOptions(this.fileset, {
      baseOptions: {
        modelAssetPath: `${import.meta.env.BASE_URL}models/hand_landmarker.task`,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: this.opts.minHandDetectionConfidence,
      minHandPresenceConfidence: this.opts.minHandDetectionConfidence,
      minTrackingConfidence: this.opts.minTrackingConfidence,
    });
  }

  private async createFaceLandmarker(): Promise<void> {
    if (!this.fileset || this.faceLandmarker) return;
    this.faceLandmarker = await FaceLandmarker.createFromOptions(this.fileset, {
      baseOptions: {
        modelAssetPath: `${import.meta.env.BASE_URL}models/face_landmarker.task`,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numFaces: 1,
      minFaceDetectionConfidence: this.opts.minFaceDetectionConfidence,
      minFacePresenceConfidence: this.opts.minFaceDetectionConfidence,
      minTrackingConfidence: this.opts.minTrackingConfidence,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    });
  }

  async start(): Promise<void> {
    if (this.running) return;

    const fileset = await FilesetResolver.forVisionTasks(`${import.meta.env.BASE_URL}mediapipe/wasm`);
    this.fileset = fileset;
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

    if (this.handsEnabled) await this.createHandLandmarker();
    if (this.faceEnabled) await this.createFaceLandmarker();

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
    this.handLandmarker?.close();
    this.handLandmarker = null;
    this.faceLandmarker?.close();
    this.faceLandmarker = null;
    this.fileset = null;
    this.smoothedHands.clear();
    this.smoothedFace = null;
    this.smoothedScreen = null;
    this.smoothedWorld = null;
    this.lastVideoTime = -1;
  }

  /** Runs the hand detector and smooths each hand against its previous self. */
  private detectHands(video: HTMLVideoElement, t: number): HandLandmarks[] {
    if (!this.handsEnabled || !this.handLandmarker) return [];
    const result = this.handLandmarker.detectForVideo(video, t);

    const seen = new Set<Handedness>();
    const hands: HandLandmarks[] = [];
    for (let i = 0; i < result.landmarks.length; i++) {
      const category = result.handedness[i]?.[0];
      // MediaPipe labels handedness from the camera's point of view; the
      // subject's own left hand is what we want to report.
      const handedness: Handedness = category?.categoryName === 'Left' ? 'Right' : 'Left';
      if (seen.has(handedness)) continue;
      seen.add(handedness);

      const prev = this.smoothedHands.get(handedness);
      const hand: HandLandmarks = {
        handedness,
        score: category?.score ?? 0,
        screen: smoothLandmarks(
          prev?.screen ?? null,
          result.landmarks[i] as ScreenLandmark[],
          this.opts.smoothing,
        ),
        world: smoothLandmarks(
          prev?.world ?? null,
          result.worldLandmarks[i] as WorldLandmark[],
          this.opts.smoothing,
        ),
      };
      this.smoothedHands.set(handedness, hand);
      hands.push(hand);
    }
    for (const key of [...this.smoothedHands.keys()]) {
      if (!seen.has(key)) this.smoothedHands.delete(key);
    }
    return hands;
  }

  /**
   * Runs the face detector. Landmarks are smoothed; blendshape scores are not,
   * since expression onsets are fast and smoothing them blunts detection.
   */
  private detectFace(video: HTMLVideoElement, t: number): FaceLandmarks | null {
    if (!this.faceEnabled || !this.faceLandmarker) return null;
    const result = this.faceLandmarker.detectForVideo(video, t);
    const raw = result.faceLandmarks[0] as ScreenLandmark[] | undefined;
    if (!raw) {
      this.smoothedFace = null;
      return null;
    }
    this.smoothedFace = smoothLandmarks(this.smoothedFace, raw, this.opts.smoothing);
    return {
      screen: this.smoothedFace,
      blendshapes: (result.faceBlendshapes[0]?.categories ?? []).map((c) => ({
        name: c.categoryName,
        score: c.score,
      })),
      matrix: result.facialTransformationMatrixes[0]?.data ?? null,
    };
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
      hands: this.detectHands(video, t0),
      face: this.detectFace(video, t0),
    };
    this.listeners.forEach((fn) => fn(frame, inferenceMs));
  };
}
