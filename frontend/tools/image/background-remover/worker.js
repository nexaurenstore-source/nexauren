import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm';

env.allowLocalModels = false;
env.useBrowserCache = true;
let pipe = null;
let device = 'wasm';

async function createPipeline(preferred) {
  const options = {
    device: preferred,
    dtype: preferred === 'webgpu' ? 'fp32' : 'q8',
    progress_callback: p => postMessage({
      type: 'model-progress',
      progress: Number(p?.progress || 0),
      status: p?.status || ''
    })
  };
  // Xenova/modnet is explicitly published for Transformers.js background-removal.
  return pipeline('background-removal', 'Xenova/modnet', options);
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
      postMessage({ type: 'fallback', message: 'WebGPU failed; using WASM instead.' });
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

    // background-removal accepts Blob/URL/string input and returns RawImage RGBA.
    const output = await pipe(msg.image);
    const image = Array.isArray(output) ? output[0] : output;
    if (!image?.data || !image.width || !image.height) {
      throw new Error('The background-removal model returned no image.');
    }

    const data = image.data instanceof Uint8ClampedArray
      ? image.data
      : new Uint8ClampedArray(image.data);
    const copy = new Uint8ClampedArray(data);

    postMessage({
      type: 'result',
      width: image.width,
      height: image.height,
      channels: image.channels || 4,
      data: copy.buffer
    }, [copy.buffer]);
  } catch (err) {
    console.error(err);
    postMessage({
      type: 'error',
      message: err?.message || 'Background removal failed.'
    });
  }
};
