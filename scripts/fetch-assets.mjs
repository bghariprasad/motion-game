// Vendors the MediaPipe WASM runtime and the pose model into public/ so the app
// serves them itself instead of reaching for a CDN at runtime. Idempotent.
import { cp, mkdir, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task';
const MODEL_PATH = 'public/models/pose_landmarker_full.task';
const WASM_SRC = 'node_modules/@mediapipe/tasks-vision/wasm';
const WASM_DEST = 'public/mediapipe/wasm';

const exists = (p) => stat(p).then(() => true, () => false);

await mkdir(WASM_DEST, { recursive: true });
await cp(WASM_SRC, WASM_DEST, { recursive: true });

if (await exists(MODEL_PATH)) {
  console.log('pose model already present');
} else {
  await mkdir('public/models', { recursive: true });
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`model download failed: ${res.status} ${res.statusText}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(MODEL_PATH));
  console.log('pose model downloaded');
}
