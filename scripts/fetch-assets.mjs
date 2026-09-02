// Vendors the MediaPipe WASM runtime and the pose model into public/ so the app
// serves them itself instead of reaching for a CDN at runtime. Idempotent.
import { cp, mkdir, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const MODELS = [
  {
    url: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task',
    path: 'public/models/pose_landmarker_full.task',
  },
  {
    url: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task',
    path: 'public/models/hand_landmarker.task',
  },
  {
    url: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
    path: 'public/models/face_landmarker.task',
  },
];
const WASM_SRC = 'node_modules/@mediapipe/tasks-vision/wasm';
const WASM_DEST = 'public/mediapipe/wasm';

const exists = (p) => stat(p).then(() => true, () => false);

await mkdir(WASM_DEST, { recursive: true });
await cp(WASM_SRC, WASM_DEST, { recursive: true });

await mkdir('public/models', { recursive: true });
for (const { url, path } of MODELS) {
  if (await exists(path)) {
    console.log(`${path} already present`);
    continue;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed for ${url}: ${res.status} ${res.statusText}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(path));
  console.log(`${path} downloaded`);
}
