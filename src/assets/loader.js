import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';

/**
 * Fetches every manifest entry with byte-accurate progress, then parses it.
 * Missing files are collected and reported together instead of failing one at a time.
 *
 * @param {import('./manifest.js').AssetEntry[]} entries
 * @param {(p: { fraction: number, label: string, loaded: number, total: number }) => void} onProgress
 * @returns {Promise<{ assets: Record<string, any>, missing: string[], optionalMissing: string[] }>}
 */
export async function loadAssets(entries, onProgress) {
  const draco = new DRACOLoader().setDecoderPath('draco/');
  const gltf = new GLTFLoader().setDRACOLoader(draco);
  const rgbe = new HDRLoader();

  const loaded = new Map(entries.map((e) => [e.id, 0]));
  const totals = new Map(entries.map((e) => [e.id, 0]));
  const report = (label) => {
    const l = [...loaded.values()].reduce((a, b) => a + b, 0);
    // Until every size is known, fall back to a file-count based estimate so the bar never jumps backwards.
    const knownAll = [...totals.values()].every((t) => t > 0);
    const t = [...totals.values()].reduce((a, b) => a + b, 0);
    const fraction = knownAll && t ? l / t : 0;
    onProgress({ fraction: Math.min(fraction, 1), label, loaded: l, total: t });
  };

  const assets = {};
  const missing = [];
  const optionalMissing = [];

  await Promise.all(
    entries.map(async (entry) => {
      try {
        const buf = await fetchWithProgress(entry.url, (got, total) => {
          loaded.set(entry.id, got);
          totals.set(entry.id, total || totals.get(entry.id) || got || 1);
          report(entry.label);
        });
        assertFormat(entry, buf);
        // Parse after download so progress reflects network, not CPU decode time.
        assets[entry.id] =
          entry.type === 'glb' ? await gltf.parseAsync(buf, entry.url.replace(/[^/]*$/, ''))
          : entry.type === 'image' ? await decodeImage(buf)
          : rgbe.parse(buf);
      } catch (err) {
        (entry.optional ? optionalMissing : missing).push(`${entry.label} (${entry.url}): ${err.message}`);
        loaded.set(entry.id, 1);
        totals.set(entry.id, 1);
      }
    }),
  );

  draco.dispose(); // frees the decoder workers once everything is parsed
  report('Ready');
  return { assets, missing, optionalMissing };
}

/**
 * Decodes JPEG/PNG bytes into an <img>. (An HTMLImageElement rather than createImageBitmap: it honours the
 * texture's flipY in every browser, Safari included.)
 */
async function decodeImage(buf) {
  const url = URL.createObjectURL(new Blob([buf]));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function fetchWithProgress(url, onChunk) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const total = Number(res.headers.get('content-length')) || 0;
  if (!res.body) {
    const buf = await res.arrayBuffer();
    onChunk(buf.byteLength, buf.byteLength);
    return buf;
  }
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onChunk(got, total || got);
  }
  const out = new Uint8Array(got);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out.buffer;
}

// Vite's dev server answers unknown paths with index.html (HTTP 200), so check magic bytes.
function assertFormat(entry, buf) {
  const head = new TextDecoder().decode(new Uint8Array(buf, 0, Math.min(10, buf.byteLength)));
  if (entry.type === 'glb' && !head.startsWith('glTF')) throw new Error('not a GLB file (file missing?)');
  if (entry.type === 'hdr' && !head.startsWith('#?')) throw new Error('not a Radiance .hdr file (file missing?)');
  if (entry.type === 'image') {
    const b = new Uint8Array(buf, 0, 4);
    const jpeg = b[0] === 0xff && b[1] === 0xd8;
    const png = b[0] === 0x89 && b[1] === 0x50;
    if (!jpeg && !png) throw new Error('not a JPEG/PNG image (file missing?)');
  }
}
