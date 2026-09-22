import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// Function to generate uncompressed / deflate-compressed PNG buffer
function createPNG(width, height, drawPixel) {
  // PNG Signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // bit depth: 8
  ihdrData.writeUInt8(6, 9); // color type: 6 (RGBA)
  ihdrData.writeUInt8(0, 10); // compression method
  ihdrData.writeUInt8(0, 11); // filter method
  ihdrData.writeUInt8(0, 12); // interlace method
  const ihdr = makeChunk('IHDR', ihdrData);

  // Raw image data with filter byte (0) per row
  const rowBytes = width * 4;
  const rawData = Buffer.alloc((rowBytes + 1) * height);

  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter byte: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawPixel(x, y, width, height);
      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
      rawData[offset++] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idat = makeChunk('IDAT', compressedData);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function makeChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcInput);

  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc, 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

// CRC32 implementation
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 0xedb88320 ^ (c >>> 1);
    } else {
      c = c >>> 1;
    }
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Pixel drawing function for ShowVerse Icon
function getShowVersePixel(x, y, w, h, isMaskable = false) {
  const cx = w / 2;
  const cy = h / 2;
  const dx = (x - cx) / cx;
  const dy = (y - cy) / cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Background
  let r = 7, g = 12, b = 24, a = 255; // Dark slate/navy #070c18
  
  if (!isMaskable) {
    // Rounded corner for standard icon
    const cornerRadius = 0.22;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (ax > (1 - cornerRadius) && ay > (1 - cornerRadius)) {
      const cdx = ax - (1 - cornerRadius);
      const cdy = ay - (1 - cornerRadius);
      if (Math.sqrt(cdx * cdx + cdy * cdy) > cornerRadius) {
        return [0, 0, 0, 0];
      }
    }
  }

  // Cyan gradient background tint
  const radialGlow = Math.max(0, 1 - dist * 1.1);
  r = Math.min(255, Math.floor(r + radialGlow * 15));
  g = Math.min(255, Math.floor(g + radialGlow * 35));
  b = Math.min(255, Math.floor(b + radialGlow * 65));

  // Neon Cyan / Purple Outer Ring
  const ringDist = Math.abs(dist - 0.78);
  if (ringDist < 0.035) {
    const ringT = (dx + 1) / 2;
    return [
      Math.floor(0 * (1 - ringT) + 168 * ringT),
      Math.floor(240 * (1 - ringT) + 85 * ringT),
      Math.floor(255 * (1 - ringT) + 247 * ringT),
      255
    ];
  }

  // Centered Triangle (Play Button)
  // Triangle in normalized coordinates: x in [-0.25, 0.35], y in [-0.35, 0.35]
  const scale = isMaskable ? 0.7 : 0.85;
  const px = dx / scale;
  const py = dy / scale;

  // Triangle vertices: (-0.2, -0.32), (-0.2, 0.32), (0.32, 0.0)
  if (px >= -0.2 && px <= 0.32) {
    const maxY = (0.32 - px) * (0.32 / 0.52);
    if (Math.abs(py) <= maxY) {
      // Inside play button
      const t = (px + 0.2) / 0.52;
      return [
        Math.floor(0 * (1 - t) + 168 * t),
        Math.floor(240 * (1 - t) + 85 * t),
        Math.floor(255 * (1 - t) + 247 * t),
        255
      ];
    }
  }

  return [r, g, b, a];
}

// Generate icons
const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 192x192
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPNG(192, 192, (x, y, w, h) => getShowVersePixel(x, y, w, h, false)));
console.log('Created pwa-192x192.png');

// 512x512
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPNG(512, 512, (x, y, w, h) => getShowVersePixel(x, y, w, h, false)));
console.log('Created pwa-512x512.png');

// 512x512 maskable (full bleed background, padded logo)
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPNG(512, 512, (x, y, w, h) => getShowVersePixel(x, y, w, h, true)));
console.log('Created pwa-maskable-512x512.png');

// Generate Android icons if android directory exists
const androidResDir = path.resolve('android', 'app', 'src', 'main', 'res');
if (fs.existsSync(androidResDir)) {
  console.log('Generating Android App Icons in:', androidResDir);
  const mipmaps = [
    { dir: 'mipmap-mdpi', iconSize: 48, fgSize: 108 },
    { dir: 'mipmap-hdpi', iconSize: 72, fgSize: 162 },
    { dir: 'mipmap-xhdpi', iconSize: 96, fgSize: 216 },
    { dir: 'mipmap-xxhdpi', iconSize: 144, fgSize: 324 },
    { dir: 'mipmap-xxxhdpi', iconSize: 192, fgSize: 432 }
  ];

  mipmaps.forEach(({ dir, iconSize, fgSize }) => {
    const targetDir = path.join(androidResDir, dir);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    // Standard icon
    fs.writeFileSync(path.join(targetDir, 'ic_launcher.png'), createPNG(iconSize, iconSize, (x, y, w, h) => getShowVersePixel(x, y, w, h, false)));
    // Round icon
    fs.writeFileSync(path.join(targetDir, 'ic_launcher_round.png'), createPNG(iconSize, iconSize, (x, y, w, h) => getShowVersePixel(x, y, w, h, true)));
    // Adaptive foreground
    fs.writeFileSync(path.join(targetDir, 'ic_launcher_foreground.png'), createPNG(fgSize, fgSize, (x, y, w, h) => getShowVersePixel(x, y, w, h, true)));
    console.log(`Generated Android icons for ${dir}`);
  });

  // Update ic_launcher_background.xml to dark navy
  const valuesDir = path.join(androidResDir, 'values');
  if (!fs.existsSync(valuesDir)) {
    fs.mkdirSync(valuesDir, { recursive: true });
  }
  const bgXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#070c18</color>
</resources>
`;
  fs.writeFileSync(path.join(valuesDir, 'ic_launcher_background.xml'), bgXml);
  console.log('Updated ic_launcher_background.xml with dark background');
}
