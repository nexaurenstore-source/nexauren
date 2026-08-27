import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm';

env.allowLocalModels = false;
env.useBrowserCache = true;
let pipe = null;
let device = 'wasm';

async function createPipeline(preferred) {
  return pipeline('background-removal', 'Xenova/modnet', {
    device: preferred,
    dtype: preferred === 'webgpu' ? 'fp32' : 'q8',
    progress_callback: p => postMessage({
      type: 'model-progress',
      progress: Number(p?.progress || 0),
      status: p?.status || ''
    })
  });
}

async function ensurePipeline() {
  if (pipe) return;
  if (self.navigator?.gpu) {
    try {
      pipe = await createPipeline('webgpu');
      device = 'webgpu';
      postMessage({ type: 'ready', device });
      return;
    } catch (err) {
      console.warn('WebGPU unavailable:', err);
      postMessage({ type: 'fallback', message: 'WebGPU unavailable. Switching to WASM.' });
    }
  }
  pipe = await createPipeline('wasm');
  device = 'wasm';
  postMessage({ type: 'ready', device });
}

self.onmessage = async event => {
  const msg = event.data || {};
  if (msg.type !== 'remove' || !msg.image) return;

  try {
    await ensurePipeline();
    postMessage({ type: 'progress', status: 'Preparing image…' });

    // The documented background-removal pipeline returns a RawImage in RGBA.
    const output = await pipe(msg.image);
    const image = Array.isArray(output) ? output[0] : output;
    if (!image?.data || !image.width || !image.height) {
      throw new Error('The AI model returned no foreground image.');
    }

    postMessage({ type: 'progress', status: 'Creating transparent PNG…' });
    const blob = await image.toBlob();
    if (!blob) throw new Error('Could not create the transparent PNG.');

    postMessage({
      type: 'result',
      blob,
      width: image.width,
      height: image.height,
      device
    });
  } catch (err) {
    console.error(err);
    postMessage({
      type: 'error',
      message: err?.message || 'Background removal failed.'
    });
  }
};
