// app.js
import { generateScene, detectObjects } from './ai.js';

const promptInput = document.getElementById('prompt');
const generateBtn = document.getElementById('generate');
const sceneImg = document.getElementById('sceneImage');
const hotspotsSvg = document.getElementById('hotspots');
const loader = document.getElementById('loader');
const info = document.getElementById('info');
const inventoryEl = document.getElementById('inventory');
let sceneMeta = { width: 0, height: 0 };
let inventory = [];

function setLoading(on) {
  loader.classList.toggle('hidden', !on);
}

function clearHotspots() {
  while (hotspotsSvg.firstChild) hotspotsSvg.removeChild(hotspotsSvg.firstChild);
}

function addInventory(itemName) {
  if (inventory.includes(itemName)) return;
  inventory.push(itemName);
  const li = document.createElement('li');
  li.textContent = itemName;
  inventoryEl.appendChild(li);
}

function showInfo(text) {
  info.textContent = text;
}

function createHotspot(obj) {
  const svgNS = "http://www.w3.org/2000/svg";
  const rect = document.createElementNS(svgNS, 'rect');
  rect.setAttribute('class', 'hotspot-rect');
  // convert normalized bbox to pixel percentages so SVG scales with image
  const xPct = obj.bbox.x * 100;
  const yPct = obj.bbox.y * 100;
  const wPct = obj.bbox.w * 100;
  const hPct = obj.bbox.h * 100;
  rect.setAttribute('x', xPct + '%');
  rect.setAttribute('y', yPct + '%');
  rect.setAttribute('width', wPct + '%');
  rect.setAttribute('height', hPct + '%');
  rect.setAttribute('data-name', obj.name);
  rect.addEventListener('click', (e) => {
    e.stopPropagation();
    // simple interaction flow
    showInfo(`${obj.name} (confidence ${(obj.confidence*100).toFixed(0)}%)`);
    // example: pick up small items (confidence threshold)
    if (obj.name.toLowerCase().match(/coin|key|gem|lantern|bottle|ring/) || obj.confidence > 0.6) {
      addInventory(obj.name);
      showInfo(`${obj.name} added to inventory.`);
      // visually fade the hotspot
      rect.style.opacity = '0.4';
      rect.removeEventListener('click', () => {});
    }
  });
  // enable pointer events on SVG child
  rect.style.pointerEvents = 'auto';
  hotspotsSvg.appendChild(rect);
}

async function generateAndDetect(prompt) {
  setLoading(true);
  clearHotspots();
  sceneImg.src = '';
  showInfo('Generating scene…');
  try {
    const { url, width, height } = await generateScene(prompt, { width: 1024, height: 640 });
    sceneMeta = { width, height };
    // load image to determine natural size and set SVG viewBox
    await new Promise((res, rej) => {
      sceneImg.onload = () => {
        // set svg viewBox to image pixel dimensions for precise overlay scaling
        const w = sceneImg.naturalWidth || width;
        const h = sceneImg.naturalHeight || height;
        hotspotsSvg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        hotspotsSvg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
        hotspotsSvg.style.width = '100%';
        hotspotsSvg.style.height = '100%';
        res();
      };
      sceneImg.onerror = rej;
      sceneImg.src = url;
    });

    showInfo('Detecting objects…');
    const objects = await detectObjects(sceneImg.src);
    if (!objects.length) {
      showInfo('No interactive objects detected. Try a different prompt.');
    } else {
      showInfo(`Detected ${objects.length} objects. Tap to interact.`);
      // convert normalized bboxes into SVG coordinates relative to natural image size
      // but we used percent-based attributes in createHotspot, so pass as-is
      objects.forEach(createHotspot);
    }
  } catch (err) {
    console.error(err);
    showInfo('Error: ' + (err.message || err));
  } finally {
    setLoading(false);
  }
}

// basic initial scene
generateBtn.addEventListener('click', () => {
  const p = promptInput.value.trim() || 'A moody attic with a wooden chest, rusty key, and an old lantern on a table';
  generateAndDetect(p);
});

// tap outside to clear info
document.getElementById('stage').addEventListener('click', () => {
  showInfo('Tap an object to inspect it.');
});

// accessibility: allow Enter to generate
promptInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') generateBtn.click();
});

// prefill and auto-generate first scene on mobile load
promptInput.value = 'A cozy cabin interior with a fireplace, a metal key on a table, and a locked chest';
generateAndDetect(promptInput.value);

