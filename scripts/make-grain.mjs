import {deflateSync} from 'node:zlib';
import {mkdir, writeFile} from 'node:fs/promises';

const width = 128, height = 128, raw = Buffer.alloc((width * 4 + 1) * height);
let seed = 0x9e3779b9;
for (let y = 0; y < height; y++) {
  raw[y * (width * 4 + 1)] = 0;
  for (let x = 0; x < width; x++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const value = 110 + (seed >>> 24) % 46;
    const offset = y * (width * 4 + 1) + 1 + x * 4;
    raw[offset] = raw[offset + 1] = raw[offset + 2] = value;
    raw[offset + 3] = 255;
  }
}
const crc = input => {
  let value = 0xffffffff;
  for (const byte of input) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
  }
  return Buffer.from([value ^ 0xffffffff >>> 24, value ^ 0xffffffff >>> 16, value ^ 0xffffffff >>> 8, value ^ 0xffffffff]);
};
const chunks = [Buffer.from([137,80,78,71,13,10,26,10])];
for (const [type, data] of [['IHDR', Buffer.from([0,0,0,128,0,0,0,128,8,6,0,0,0])], ['IDAT', deflateSync(raw)], ['IEND', Buffer.alloc(0)]]) {
  const body = Buffer.concat([Buffer.from(type), data]);
  chunks.push(Buffer.concat([Buffer.alloc(4), body, crc(body)]));
  chunks.at(-1).writeUInt32BE(data.length, 0);
}
await mkdir('web/tv/img', {recursive: true});
await writeFile('web/tv/img/grain.png', Buffer.concat(chunks));
