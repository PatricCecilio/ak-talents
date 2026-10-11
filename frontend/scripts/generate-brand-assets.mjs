// Generates the favicon, app icons and the share preview image from the official logo.
//
//   node scripts/generate-brand-assets.mjs
//
// Source: src/assets/ak-talent-logo.png (official mark, transparent background). Only a small PNG exists today, so
// the mark is ~110 px wide: icons up to 180 px are sharp, 192/512 px are slightly soft. When a vector or high
// resolution logo is available, replace the source file and run this script again.
// favicon.svg wraps a PNG of the mark (no vector source exists); browsers still pick it for crisp tab icons.
//
// Needs Google Chrome (CHROME_PATH to override the default Windows path) and playwright-core (devDependency).
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = join(root, 'public')
const logoPath = join(root, 'src', 'assets', 'ak-talent-logo.png')
const chromePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const logoDataUrl = `data:image/png;base64,${readFileSync(logoPath).toString('base64')}`

const BRAND = { ink: '#061424', gold: '#a87224', background: '#f5f7fa' }
const HEADLINE = 'Encontre os melhores talentos'
const HEADLINE_ACCENT = 'sem perder o controle.'
const TAGLINE = 'Recrutamento para empresas que crescem'

// Draws the mark (the part of the logo left of the "Ak Talent" text) into a square canvas and returns a PNG data URL.
async function renderMark(page, { size, padding, background }) {
  return page.evaluate(
    async ({ src, size, padding, background }) => {
      const image = new Image()
      image.src = src
      await image.decode()
      const source = document.createElement('canvas')
      source.width = image.width
      source.height = image.height
      const sctx = source.getContext('2d')
      sctx.drawImage(image, 0, 0)
      const pixels = sctx.getImageData(0, 0, image.width, image.height).data
      const ink = (x, y) => pixels[(y * image.width + x) * 4 + 3] > 40

      // The mark is the first run of non-empty columns (the text starts after a transparent gap).
      let left = -1
      let right = -1
      for (let x = 0; x < image.width; x++) {
        let filled = false
        for (let y = 0; y < image.height && !filled; y++) filled = ink(x, y)
        if (filled && left < 0) left = x
        if (!filled && left >= 0) {
          right = x - 1
          break
        }
      }
      let top = image.height
      let bottom = 0
      for (let y = 0; y < image.height; y++) {
        for (let x = left; x <= right; x++) {
          if (ink(x, y)) {
            top = Math.min(top, y)
            bottom = Math.max(bottom, y)
          }
        }
      }
      const width = right - left + 1
      const height = bottom - top + 1

      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (background) {
        ctx.fillStyle = background
        ctx.fillRect(0, 0, size, size)
      }
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      const box = size - padding * 2
      const scale = Math.min(box / width, box / height)
      const drawWidth = width * scale
      const drawHeight = height * scale
      ctx.drawImage(source, left, top, width, height, (size - drawWidth) / 2, (size - drawHeight) / 2, drawWidth, drawHeight)
      return canvas.toDataURL('image/png')
    },
    { src: logoDataUrl, size, padding, background },
  )
}

const pngBuffer = (dataUrl) => Buffer.from(dataUrl.split(',')[1], 'base64')

// ICO container holding one PNG image (supported by every current browser and by Windows).
function icoFromPng(png, size) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2) // icon
  header.writeUInt16LE(1, 4) // one image
  const entry = Buffer.alloc(16)
  entry.writeUInt8(size >= 256 ? 0 : size, 0)
  entry.writeUInt8(size >= 256 ? 0 : size, 1)
  entry.writeUInt8(0, 2) // no palette
  entry.writeUInt8(0, 3)
  entry.writeUInt16LE(1, 4) // planes
  entry.writeUInt16LE(32, 6) // bits per pixel
  entry.writeUInt32LE(png.length, 8)
  entry.writeUInt32LE(header.length + entry.length, 12)
  return Buffer.concat([header, entry, png])
}

const shareImageHtml = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600&family=Plus+Jakarta+Sans:wght@700;800&display=block" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; background: ${BRAND.background}; font-family: Inter, sans-serif; color: ${BRAND.ink};
    position: relative; overflow: hidden; }
  .glow { position: absolute; right: -180px; top: -200px; width: 640px; height: 640px; border-radius: 50%;
    background: radial-gradient(circle, rgba(168,114,36,.18), rgba(168,114,36,0) 68%); }
  .bar { position: absolute; left: 0; bottom: 0; width: 100%; height: 14px; background: ${BRAND.gold}; }
  main { position: absolute; inset: 0; padding: 72px 88px; display: flex; flex-direction: column; justify-content: center; }
  img { width: 306px; height: auto; }
  .tag { margin-top: 44px; font-size: 22px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: #52637a; }
  h1 { margin-top: 18px; font-family: 'Plus Jakarta Sans', Inter, sans-serif; font-weight: 800; font-size: 76px; line-height: 1.04;
    letter-spacing: -0.03em; max-width: 1000px; }
  h1 span { color: ${BRAND.gold}; display: block; }
  .site { margin-top: 30px; font-size: 26px; font-weight: 600; color: #254666; }
</style></head><body>
<div class="glow"></div>
<main>
  <img src="${logoDataUrl}" alt="AK Talent">
  <p class="tag">${TAGLINE}</p>
  <h1>${HEADLINE}<span>${HEADLINE_ACCENT}</span></h1>
  <p class="site">aktalent.com.br</p>
</main>
<div class="bar"></div>
</body></html>`

const browser = await chromium.launch({ executablePath: chromePath })
try {
  const page = await browser.newPage()

  const favicon32 = pngBuffer(await renderMark(page, { size: 32, padding: 1, background: null }))
  writeFileSync(join(publicDir, 'favicon.ico'), icoFromPng(favicon32, 32))

  const markSvg = await renderMark(page, { size: 96, padding: 3, background: null })
  writeFileSync(
    join(publicDir, 'favicon.svg'),
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="64" height="64" viewBox="0 0 64 64"><title>AK Talent</title><image width="64" height="64" href="${markSvg}" xlink:href="${markSvg}"/></svg>\n`,
  )

  // Home screen icons: white tile, mark inside the "maskable" safe zone (inner 80%).
  writeFileSync(join(publicDir, 'apple-touch-icon.png'), pngBuffer(await renderMark(page, { size: 180, padding: 22, background: '#ffffff' })))
  writeFileSync(join(publicDir, 'icon-192.png'), pngBuffer(await renderMark(page, { size: 192, padding: 30, background: '#ffffff' })))
  writeFileSync(join(publicDir, 'icon-512.png'), pngBuffer(await renderMark(page, { size: 512, padding: 80, background: '#ffffff' })))

  const share = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
  await share.setContent(shareImageHtml, { waitUntil: 'networkidle' })
  await share.evaluate(() => document.fonts.ready)
  await share.screenshot({ path: join(publicDir, 'og-image.png'), type: 'png' })

  console.log('ok: favicon.ico, favicon.svg, apple-touch-icon.png, icon-192.png, icon-512.png, og-image.png')
} finally {
  await browser.close()
}
