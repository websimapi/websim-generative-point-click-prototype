// ai.js
// Thin helpers for WebSim image generation + object detection via websim API.
// Exports: generateScene(prompt) -> { url, width, height }
//          detectObjects(imageUrl) -> [{name, confidence, bbox:{x,y,w,h}}]
// NOTE: websim global is expected (provided by environment per spec).

export async function generateScene(prompt, opts = {}) {
  // simple image generation call — adjust size for mobile
  const width = opts.width || 1024;
  const height = opts.height || 640;
  const result = await websim.imageGen({
    prompt,
    width,
    height,
  });
  // result.url
  return { url: result.url, width, height };
}

export async function detectObjects(imageUrl) {
  // Use an in-browser detector (TensorFlow.js + coco-ssd) to avoid sending the image to the chat API.
  // Loads libraries on demand, runs detection on the image, and returns normalized boxes.
  // Create an image element to feed into the model
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = imageUrl;
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = () => rej(new Error('Failed to load image for detection'));
  });

  // dynamic import of TF and coco-ssd via CDN
  const [{default: tf}, cocoSsdModule] = await Promise.all([
    import('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.12.0/dist/tf.min.js'),
    import('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.2/dist/coco-ssd.min.js'),
  ]);

  // warm up and load model
  // coco-ssd exposes a default export; call .load() from that default
  const model = await cocoSsdModule.default.load();

  // run detection
  const predictions = await model.detect(img);

  // predictions: [{bbox: [x,y,width,height], class, score}, ...]
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  return predictions.map(p => ({
    name: p.class || 'object',
    confidence: Number(p.score || 0),
    bbox: {
      x: Number((p.bbox[0] / w) || 0),
      y: Number((p.bbox[1] / h) || 0),
      w: Number((p.bbox[2] / w) || 0),
      h: Number((p.bbox[3] / h) || 0),
    }
  }));
}