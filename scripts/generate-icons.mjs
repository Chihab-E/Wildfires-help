/**
 * يولّد أيقونات PWA بصيغة PNG بدون أي اعتمادية خارجية.
 * التشغيل: npm run icons
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

/* ------------------------------ ترميز PNG ------------------------------ */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

/** يبني ملف PNG من مخزن RGBA. */
function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // color type: RGBA
  // 10..12: compression / filter / interlace = 0

  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/* ------------------------------- الرسم -------------------------------- */

const BG = [11, 15, 20]
const FLAME_OUTER = [239, 68, 68]
const FLAME_MID = [249, 115, 22]
const FLAME_INNER = [251, 191, 36]

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

/** نصف عرض اللهب عند الارتفاع y (بالإحداثيات المعيارية، y للأعلى). */
function flameHalfWidth(y, scale) {
  const u = (y / scale + 0.85) / 1.8
  if (u <= 0 || u >= 1) return 0
  return scale * 0.55 * Math.sin(Math.PI * Math.pow(u, 0.7)) ** 1.05
}

function insideFlame(x, y, scale) {
  if (Math.abs(x) <= flameHalfWidth(y, scale)) return true
  // قاعدة دائرية تمنع التدبيب من الأسفل
  const dy = y + 0.45 * scale
  return x * x + dy * dy <= (0.37 * scale) ** 2
}

/** تنعيم الحواف بأخذ 3×3 عيّنات لكل بكسل. */
function coverage(px, py, size, test) {
  let hits = 0
  for (let sy = 0; sy < 3; sy++) {
    for (let sx = 0; sx < 3; sx++) {
      const x = ((px + (sx + 0.5) / 3) / size) * 2 - 1
      const y = 1 - ((py + (sy + 0.5) / 3) / size) * 2
      if (test(x, y)) hits++
    }
  }
  return hits / 9
}

function roundedSquare(radius) {
  return (x, y) => {
    const ax = Math.abs(x)
    const ay = Math.abs(y)
    const limit = 1 - radius
    if (ax <= limit || ay <= limit) return ax <= 1 && ay <= 1
    const dx = ax - limit
    const dy = ay - limit
    return dx * dx + dy * dy <= radius * radius
  }
}

/**
 * @param {number} size
 * @param {boolean} maskable خلفية ممتلئة ولهب أصغر (منطقة أمان 80%)
 */
function drawIcon(size, maskable) {
  const rgba = Buffer.alloc(size * size * 4)
  const bgTest = maskable ? () => true : roundedSquare(0.22)
  const flameScale = maskable ? 0.62 : 0.82

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const offset = (py * size + px) * 4

      const bgAlpha = coverage(px, py, size, bgTest)
      if (bgAlpha === 0) continue

      // اللهب مرفوع قليلاً ليبدو متوازناً بصرياً
      const flameAlpha = coverage(px, py, size, (x, y) =>
        insideFlame(x, y - 0.04, flameScale),
      )
      const innerAlpha = coverage(px, py, size, (x, y) =>
        insideFlame(x, (y - 0.18) / 0.52, flameScale * 0.52),
      )

      let color = BG
      if (flameAlpha > 0) {
        // تدرّج رأسي من البرتقالي أسفل إلى الأحمر أعلى
        const t = Math.min(1, Math.max(0, (py / size - 0.15) / 0.7))
        const flameColor = mix(FLAME_MID, FLAME_OUTER, 1 - t)
        color = mix(color, flameColor, flameAlpha)
      }
      if (innerAlpha > 0) color = mix(color, FLAME_INNER, innerAlpha)

      rgba[offset] = color[0]
      rgba[offset + 1] = color[1]
      rgba[offset + 2] = color[2]
      rgba[offset + 3] = Math.round(bgAlpha * 255)
    }
  }

  return encodePng(size, size, rgba)
}

/* ------------------------------- التنفيذ ------------------------------- */

mkdirSync(OUT_DIR, { recursive: true })

const TARGETS = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon-180.png', size: 180, maskable: true },
]

for (const target of TARGETS) {
  const png = drawIcon(target.size, target.maskable)
  writeFileSync(join(OUT_DIR, target.file), png)
  console.log(`${target.file}  ${png.length} bytes`)
}
