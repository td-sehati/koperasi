import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const outDir = path.resolve("public/icons");
fs.mkdirSync(outDir, { recursive: true });

const makeCrcTable = () => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
};

const crcTable = makeCrcTable();
const crc32 = (buffer) => {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    c = crcTable[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const typeBuf = Buffer.from(type, "ascii");
  const lengthBuf = Buffer.alloc(4);
  lengthBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([lengthBuf, typeBuf, data, crcBuf]);
};

const createPng = (width, height, pixels) => {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }

  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
};

const drawIcon = (size) => {
  const px = Buffer.alloc(size * size * 4);

  const setPixel = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const idx = (y * size + x) * 4;
    px[idx] = r;
    px[idx + 1] = g;
    px[idx + 2] = b;
    px[idx + 3] = a;
  };

  const bg = { r: 5, g: 150, b: 105 };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      setPixel(x, y, bg.r, bg.g, bg.b);
    }
  }

  const cx = size / 2;
  const cy = size / 2;
  const circleR = Math.floor(size * 0.28);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= circleR * circleR) {
        setPixel(x, y, 255, 255, 255);
      }
    }
  }

  const lineColor = { r: 5, g: 150, b: 105 };
  const barW = Math.floor(size * 0.36);
  const barH = Math.max(2, Math.floor(size * 0.04));
  const left = Math.floor(size * 0.22);
  const topStart = Math.floor(size * 0.43);
  const gaps = Math.floor(size * 0.04);
  for (let i = 0; i < 3; i += 1) {
    const y0 = topStart + i * (barH + gaps);
    const width = barW - i * Math.floor(size * 0.04);
    for (let y = y0; y < y0 + barH; y += 1) {
      for (let x = left; x < left + width; x += 1) {
        setPixel(x, y, lineColor.r, lineColor.g, lineColor.b);
      }
    }
  }

  return createPng(size, size, px);
};

fs.writeFileSync(path.join(outDir, "icon-192.png"), drawIcon(192));
fs.writeFileSync(path.join(outDir, "icon-512.png"), drawIcon(512));
fs.writeFileSync(path.join(outDir, "apple-touch-icon.png"), drawIcon(180));

console.log("Generated icons in public/icons");
