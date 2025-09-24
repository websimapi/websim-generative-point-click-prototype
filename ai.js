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
  // Use websim.chat.completions with json response schema.
  // We ask the assistant to return JSON list of objects with relative bbox [x,y,w,h] (0..1).
  const system = {
    role: "system",
    content: "You are an object detection assistant. Inspect the provided image and return a JSON array of detected interactive objects. Each item: {name:string, confidence:number, bbox:{x:number,y:number,w:number,h:number}}. Coordinates must be normalized (0..1). Respond with only valid JSON."
  };
  const user = {
    role: "user",
    content: [
      { type: "text", text: "Detect interactive objects in this scene. Be concise." },
      { type: "image_url", image_url: { url: imageUrl } }
    ],
    json: true
  };

  const completion = await websim.chat.completions.create({
    messages: [system, user],
  });
  // completion.content should be JSON
  try {
    const parsed = JSON.parse(completion.content);
    // basic validation and normalization
    return (Array.isArray(parsed) ? parsed : []).map((it) => ({
      name: it.name || "object",
      confidence: Number(it.confidence || 0),
      bbox: {
        x: Number((it.bbox?.x || 0)),
        y: Number((it.bbox?.y || 0)),
        w: Number((it.bbox?.w || 0)),
        h: Number((it.bbox?.h || 0)),
      }
    }));
  } catch (e) {
    console.warn("object detection parse failed", e);
    return [];
  }
}

