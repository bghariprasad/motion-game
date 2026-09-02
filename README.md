# Camera Motion Harness

Webcam body tracking in the browser: MediaPipe Pose Landmarker maps 33 body
landmarks, the canvas draws the skeleton with a per-joint coordinate frame at
each articulation, and a live telemetry panel prints joint angles, limb
velocities and posture scalars as you move.

This is the sensing layer for a Kinect-style motion game — it produces the
numbers a game loop reads. There is no game on top of it yet.

## Run

```bash
npm install
npm run dev
```

Open the printed URL and click **Start camera**. `npm run dev` vendors the
MediaPipe WASM runtime and downloads the ~9 MB pose model into `public/` on
first run; both are gitignored and re-fetched by `npm run setup:assets`.

Camera access needs a secure context: `localhost` works, any other host needs
HTTPS.

## Layout

| Path | Role |
| --- | --- |
| `src/harness/PoseEngine.ts` | Webcam stream, MediaPipe detector, capture loop. Emits a `PoseFrame` per video frame. |
| `src/harness/kinematics.ts` | Vector math, joint coordinate frames, angles, velocities, smoothing. |
| `src/harness/render.ts` | Canvas overlay: bones, joint dots, RGB axis triads, the fixed `F^T` world frame. |
| `src/harness/landmarks.ts` | Landmark indices, bone list, joint colouring. |
| `src/harness/types.ts` | Shared types. |
| `src/components/TelemetryPanel.tsx` | Numeric readout. |

## What the overlay draws

* **Bones** — thick black segments between tracked landmarks.
* **Joints** — green at the torso anchors (shoulders, hips), yellow elsewhere.
* **Axis triads** — an orthonormal frame per joint, from the 3D world
  landmarks. Red is the distal bone direction, blue the hinge axis, green
  completes the right-handed triad. At the pelvis the frame is anatomical:
  red across the hips, green up the spine, blue out of the chest.
* **`F^T`** — the fixed world reference frame, bottom left.

Axes are projected orthographically (world X→screen X, world Y→screen Y), so
depth reads as foreshortening rather than as a separate perspective.

## Telemetry

Emitted at 12 Hz from `computeTelemetry`, while the canvas draws every frame.

* Eight joint angles: both elbows, shoulders, hips, knees, in degrees, dimmed
  when landmark visibility drops below 0.5.
* Point velocities in m/s for wrists, elbows, knees, ankles, from the metric
  world landmarks.
* Motion energy: mean landmark speed over the body, in m/s.
* Torso lean from vertical, in degrees; positive leans to the subject's left.
* Hip height above the ankle midpoint, in metres — the substrate for squat and
  jump detection.

## Building a game on this

`PoseEngine.onFrame` is the extension point. Subscribe, feed frames to your own
detectors, and drive game state from the telemetry — hip height for squats and
jumps, wrist velocity for punches, joint angles for pose matching.

Landmarks are exponentially smoothed (`smoothing: 0.55` by default); lower it
for less lag and more jitter.
