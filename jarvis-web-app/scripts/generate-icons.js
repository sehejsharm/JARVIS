// Generates JARVIS arc-reactor PWA icons as PNGs with zero external deps.
// Pure pixel painting + a minimal PNG encoder built on Node's zlib.

import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "public", "icons");

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Add filter byte (0) at the start of each row.
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function drawIcon(size, maskable = false) {
  const rgba = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const safe = maskable ? 0.72 : 0.92; // shrink art for maskable safe zone
  const R = (size / 2) * safe;

  const black = [3, 6, 8];
  const deep = [6, 24, 30];
  const cyan = [34, 211, 238];
  const white = [220, 250, 255];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      const idx = (y * size + x) * 4;

      // Background gradient (dark, faint cyan glow toward center).
      let col = mix(deep, black, Math.min(1, d / (size / 2)));
      let alpha = 255;

      const nr = d / R; // normalized radius vs. art radius

      // Outer glow ring
      if (nr > 0.82 && nr < 0.98) {
        const t = 1 - Math.abs(nr - 0.9) / 0.08;
        col = mix(col, cyan, Math.max(0, t) * 0.9);
      }
      // Mid dashed-feel ring
      if (nr > 0.55 && nr < 0.63) {
        const t = 1 - Math.abs(nr - 0.59) / 0.04;
        col = mix(col, cyan, Math.max(0, t) * 0.7);
      }
      // Inner core glow
      if (nr < 0.34) {
        const t = 1 - nr / 0.34;
        col = mix(col, white, t * t * 0.85);
        col = mix(col, cyan, (1 - t) * 0.6);
      }

      // Outside the art radius: transparent for maskable padding, dark otherwise.
      if (nr > 1.0) {
        if (maskable) { alpha = 255; col = black; }
        else { alpha = 0; }
      }

      rgba[idx] = col[0];
      rgba[idx + 1] = col[1];
      rgba[idx + 2] = col[2];
      rgba[idx + 3] = alpha;
    }
  }
  return encodePNG(size, size, rgba);
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "icon-192.png"), drawIcon(192));
fs.writeFileSync(path.join(OUT, "icon-512.png"), drawIcon(512));
fs.writeFileSync(path.join(OUT, "icon-512-maskable.png"), drawIcon(512, true));
console.log("Icons written to", OUT);
