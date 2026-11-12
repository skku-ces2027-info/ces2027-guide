// Render the two painted maps of the first screen to WebP, so browsers show a picture instead of
// working out the SVG paint filter on every visit (slow, above all in Safari).
//
//     node tools/render_maps.mjs
//
// Reads maps/strip.svg and maps/city.svg (made by tools/refine_maps.py and tools/city_map.py) and writes
// maps/hero-1000.webp, hero-1600.webp, hero-2600.webp and maps/city-1200.webp, city-2000.webp.
// Needs Node 22 or later and Google Chrome; set CHROME to its path if it is not in the usual macOS place.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MAPS = join(dirname(fileURLToPath(import.meta.url)), '..', 'maps');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const RATIO = 1940 / 2120;                       // both pictures share the view box of tools/refine_maps.py
const JOBS = [
  { src: 'strip.svg', name: 'hero', widths: [1000, 1600, 2600], quality: 84 },
  { src: 'city.svg', name: 'city', widths: [1200, 2000], quality: 80 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'render-maps-'));
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, ['--headless=new', '--hide-scrollbars', `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, 'about:blank'], { stdio: 'ignore' });
try {
  let page;
  for (let i = 0; i < 50 && !page; i++) {
    try { page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch (e) { await sleep(200); }
  }
  if (!page) throw new Error('Chrome did not start: ' + CHROME);
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const waiting = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && waiting.has(d.id)) { waiting.get(d.id)(d.result); waiting.delete(d.id); } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; waiting.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Page.enable');
  for (const job of JOBS) {
    for (const width of job.widths) {
      const height = Math.round(width * RATIO);
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      await send('Page.navigate', { url: pathToFileURL(join(MAPS, job.src)).href });
      await sleep(2500 + width);               // the paint filter takes a while at large sizes
      const shot = await send('Page.captureScreenshot', { format: 'webp', quality: job.quality });
      const out = `${job.name}-${width}.webp`, data = Buffer.from(shot.data, 'base64');
      writeFileSync(join(MAPS, out), data);
      console.log(`${out.padEnd(18)} ${width} x ${height}  ${Math.round(data.length / 1024)} KB`);
    }
  }
  ws.close();
} finally {
  chrome.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
