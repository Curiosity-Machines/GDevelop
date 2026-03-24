/**
 * Cloudflare Pages Function: /qr/:id/image
 *
 * Generates a QR code PNG server-side for use as og:image in unfurls.
 * The QR encodes the same stable manifest URL that client-side QR codes use.
 */
import qrcode from 'qrcode-generator';
import { getManifestUrl, isValidUUID } from '../../_shared/config';

interface Env {
  ASSETS: { fetch: (req: Request) => Promise<Response> };
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { id } = context.params as { id: string };

  if (!isValidUUID(id)) {
    return new Response('Invalid activity ID', { status: 400 });
  }

  const manifestUrl = getManifestUrl(id);

  const qr = qrcode(0, 'M');
  qr.addData(manifestUrl);
  qr.make();

  const moduleCount = qr.getModuleCount();
  const scale = 10;
  const margin = 4;
  const size = (moduleCount + margin * 2) * scale;

  // Build grayscale pixel data
  const pixels = new Uint8Array(size * size);
  pixels.fill(0xff); // white

  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (qr.isDark(row, col)) {
        const sx = (col + margin) * scale;
        const sy = (row + margin) * scale;
        for (let py = 0; py < scale; py++) {
          for (let px = 0; px < scale; px++) {
            pixels[(sy + py) * size + (sx + px)] = 0x00;
          }
        }
      }
    }
  }

  const png = await buildPNG(size, size, pixels);

  return new Response(png, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  });
};

// --- Minimal PNG encoder (grayscale, 8-bit) ---

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function writeU32BE(arr: Uint8Array, offset: number, val: number) {
  arr[offset] = (val >>> 24) & 0xff;
  arr[offset + 1] = (val >>> 16) & 0xff;
  arr[offset + 2] = (val >>> 8) & 0xff;
  arr[offset + 3] = val & 0xff;
}

function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(4 + 4 + data.length + 4);
  writeU32BE(chunk, 0, data.length);
  chunk[4] = type.charCodeAt(0);
  chunk[5] = type.charCodeAt(1);
  chunk[6] = type.charCodeAt(2);
  chunk[7] = type.charCodeAt(3);
  chunk.set(data, 8);
  const crcData = chunk.subarray(4, 8 + data.length);
  writeU32BE(chunk, 8 + data.length, crc32(crcData));
  return chunk;
}

async function buildPNG(
  width: number,
  height: number,
  pixels: Uint8Array,
): Promise<Uint8Array> {
  const ihdrData = new Uint8Array(13);
  writeU32BE(ihdrData, 0, width);
  writeU32BE(ihdrData, 4, height);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 0;  // color type: grayscale
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter method
  ihdrData[12] = 0; // interlace

  const rowLen = 1 + width;
  const raw = new Uint8Array(height * rowLen);
  for (let y = 0; y < height; y++) {
    raw[y * rowLen] = 0; // filter: None
    raw.set(pixels.subarray(y * width, (y + 1) * width), y * rowLen + 1);
  }

  const compressed = await zlibCompress(raw);

  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = makeChunk('IHDR', ihdrData);
  const idat = makeChunk('IDAT', compressed);
  const iend = makeChunk('IEND', new Uint8Array(0));

  const png = new Uint8Array(
    signature.length + ihdr.length + idat.length + iend.length,
  );
  let off = 0;
  png.set(signature, off); off += signature.length;
  png.set(ihdr, off); off += ihdr.length;
  png.set(idat, off); off += idat.length;
  png.set(iend, off);
  return png;
}

async function zlibCompress(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate');
  const writer = cs.writable.getWriter();
  writer.write(data);
  writer.close();

  const chunks: Uint8Array[] = [];
  const reader = cs.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLen = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(totalLen);
  let off = 0;
  for (const c of chunks) {
    result.set(c, off);
    off += c.length;
  }
  return result;
}
