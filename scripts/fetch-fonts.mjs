/**
 * ينزّل خط IBM Plex Sans Arabic من Google Fonts ويحفظه محلياً.
 *
 * لماذا محلياً وليس عبر رابط Google؟
 *  - التطبيق PWA يجب أن يعمل دون اتصال، والخط جزء من الواجهة.
 *  - طلب خارجي إضافي يبطئ أول تحميل على شبكة ضعيفة.
 *  - لا تتبّع من طرف ثالث.
 *
 * التشغيل: npm run fonts
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const FONT_DIR = join(ROOT, 'public', 'fonts')

const FAMILY = 'IBM Plex Sans Arabic'
const WEIGHTS = [400, 500, 700]
/** نكتفي بالعربية واللاتينية — لا حاجة للسيريلية */
const SUBSETS = new Set(['arabic', 'latin'])

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

const cssUrl =
  `https://fonts.googleapis.com/css2?family=${FAMILY.replace(/ /g, '+')}` +
  `:wght@${WEIGHTS.join(';')}&display=swap`

const css = await (await fetch(cssUrl, { headers: { 'User-Agent': CHROME_UA } })).text()

/** يقسّم ملف CSS إلى كتل @font-face مسبوقة بتعليق اسم المجموعة. */
function parseBlocks(source) {
  const blocks = []
  const pattern = /\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([^}]+)\}/g
  for (const [, subset, body] of source.matchAll(pattern)) {
    const weight = Number(body.match(/font-weight:\s*(\d+)/)?.[1])
    const url = body.match(/url\((https:[^)]+\.woff2)\)/)?.[1]
    const range = body.match(/unicode-range:\s*([^;]+);/)?.[1]?.trim()
    if (weight && url && range) blocks.push({ subset, weight, url, range })
  }
  return blocks
}

const blocks = parseBlocks(css).filter((block) => SUBSETS.has(block.subset))
if (blocks.length === 0) throw new Error('لم يُعثر على أي كتلة @font-face مطابقة')

mkdirSync(FONT_DIR, { recursive: true })

const rules = []
for (const block of blocks) {
  const file = `plex-arabic-${block.subset}-${block.weight}.woff2`
  const bytes = new Uint8Array(await (await fetch(block.url)).arrayBuffer())
  writeFileSync(join(FONT_DIR, file), bytes)
  console.log(`${file}  ${(bytes.length / 1024).toFixed(1)} KB`)

  rules.push(
    `@font-face {\n` +
      `  font-family: '${FAMILY}';\n` +
      `  font-style: normal;\n` +
      `  font-weight: ${block.weight};\n` +
      `  font-display: swap;\n` +
      `  src: url('/fonts/${file}') format('woff2');\n` +
      `  unicode-range: ${block.range};\n` +
      `}`,
  )
}

writeFileSync(
  join(ROOT, 'src', 'fonts.css'),
  `/* مولّد آلياً بواسطة scripts/fetch-fonts.mjs — لا تعدّله يدوياً. */\n\n${rules.join('\n\n')}\n`,
)
console.log(`\nsrc/fonts.css  ${rules.length} قاعدة`)
