import { mkdir, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import path from "node:path";

const outputDirectory = fileURLToPath(new URL("../public/icons/", import.meta.url));
const primary = [49, 93, 232];
const white = [255, 255, 255];
const supersampling = 4;

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function insideRoundedSquare(x, y, size) {
  const inset = size * 0.06;
  const radius = size * 0.18;
  const left = inset + radius;
  const right = size - inset - radius;
  const top = inset + radius;
  const bottom = size - inset - radius;
  const nearestX = Math.max(left, Math.min(right, x));
  const nearestY = Math.max(top, Math.min(bottom, y));
  return (x - nearestX) ** 2 + (y - nearestY) ** 2 <= radius ** 2;
}

function insideMark(x, y, size) {
  const relativeX = x / size;
  const relativeY = y / size;
  const distance = Math.hypot(relativeX - 0.48, relativeY - 0.5);
  const crescent =
    distance >= 0.17 && distance <= 0.3 && relativeX <= 0.58;
  const dot = Math.hypot(relativeX - 0.7, relativeY - 0.49) <= 0.09;
  return crescent || dot;
}

function renderPng(size, maskable = false) {
  const pixels = Buffer.alloc((size * 4 + 1) * size);
  const samples = supersampling * supersampling;

  for (let y = 0; y < size; y += 1) {
    const rowOffset = y * (size * 4 + 1);
    pixels[rowOffset] = 0;
    for (let x = 0; x < size; x += 1) {
      let backgroundSamples = 0;
      let markSamples = 0;
      for (let sy = 0; sy < supersampling; sy += 1) {
        for (let sx = 0; sx < supersampling; sx += 1) {
          const sampleX = x + (sx + 0.5) / supersampling;
          const sampleY = y + (sy + 0.5) / supersampling;
          const inBackground = maskable || insideRoundedSquare(sampleX, sampleY, size);
          if (inBackground) {
            backgroundSamples += 1;
            if (insideMark(sampleX, sampleY, size)) markSamples += 1;
          }
        }
      }

      if (backgroundSamples === 0) continue;
      const pixelOffset = rowOffset + 1 + x * 4;
      const backgroundWeight = backgroundSamples - markSamples;
      for (let channel = 0; channel < 3; channel += 1) {
        pixels[pixelOffset + channel] = Math.round(
          (primary[channel] * backgroundWeight + white[channel] * markSamples) /
            backgroundSamples,
        );
      }
      pixels[pixelOffset + 3] = Math.round((backgroundSamples / samples) * 255);
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(pixels)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

await mkdir(outputDirectory, { recursive: true });
const icons = [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["icon-maskable-512.png", 512, true],
  ["apple-touch-icon.png", 180, false],
  ["favicon.png", 32, false],
];

for (const [filename, size, maskable] of icons) {
  await writeFile(path.join(outputDirectory, filename), renderPng(size, maskable));
}

console.log(`Generated ${icons.length} Largent mark icons in ${outputDirectory}`);
