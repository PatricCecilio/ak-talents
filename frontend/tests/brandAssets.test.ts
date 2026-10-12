import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

const root = new URL('../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf8')
const bytes = (path: string) => readFileSync(new URL(path, root))

// Width/height from the PNG IHDR chunk.
function pngSize(buffer: Buffer): [number, number] {
  assert.equal(buffer.subarray(1, 4).toString('latin1'), 'PNG')
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)]
}

test('icons generated from the official logo, with the right sizes', () => {
  assert.deepEqual(pngSize(bytes('public/apple-touch-icon.png')), [180, 180])
  assert.deepEqual(pngSize(bytes('public/icon-192.png')), [192, 192])
  assert.deepEqual(pngSize(bytes('public/icon-512.png')), [512, 512])
  assert.deepEqual(pngSize(bytes('public/og-image.png')), [1200, 630])

  const ico = bytes('public/favicon.ico')
  assert.equal(ico.readUInt16LE(2), 1, 'tipo ícone')
  assert.equal(ico.readUInt16LE(4), 1, 'uma imagem')
  assert.equal(ico.readUInt8(6), 32, 'largura 32')
  assert.deepEqual(pngSize(ico.subarray(ico.readUInt32LE(18))), [32, 32])

  const svg = read('public/favicon.svg')
  assert.match(svg, /<title>AK Talent<\/title>/)
  assert.match(svg, /data:image\/png;base64,/)
  // The generator is versioned, so the icons can be redone from a better logo file.
  assert.match(read('scripts/generate-brand-assets.mjs'), /src', 'assets', 'ak-talent-logo\.png'/)
})

test('no Vite/React default icons left', () => {
  assert.doesNotMatch(read('public/favicon.svg'), /#863bff/i) // Vite's purple bolt
  for (const file of ['public/icons.svg', 'src/assets/vite.svg', 'src/assets/react.svg']) {
    assert.equal(existsSync(new URL(file, root)), false, file)
  }
})

test('web app manifest with the brand name and colors', () => {
  const manifest = JSON.parse(read('public/site.webmanifest'))
  assert.equal(manifest.name, 'AK Talent')
  assert.equal(manifest.short_name, 'AK Talent')
  assert.equal(manifest.theme_color, '#061424')
  assert.equal(manifest.background_color, '#ffffff')
  assert.deepEqual(
    manifest.icons.map((icon: { src: string; sizes: string }) => [icon.src, icon.sizes]),
    [
      ['/icon-192.png', '192x192'],
      ['/icon-512.png', '512x512'],
    ],
  )
})

test('index.html: icons, manifest and share preview tags (Portuguese, absolute image URL)', () => {
  const html = read('index.html')
  for (const tag of [
    '<link rel="icon" href="/favicon.ico" sizes="32x32" />',
    '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
    '<link rel="manifest" href="/site.webmanifest" />',
    '<meta name="theme-color" content="#061424" />',
    '<meta property="og:image" content="https://www.aktalent.com.br/og-image.png" />',
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    '<meta property="og:locale" content="pt_BR" />',
    '<meta name="twitter:card" content="summary_large_image" />',
    '<meta name="twitter:image" content="https://www.aktalent.com.br/og-image.png" />',
  ]) {
    assert.ok(html.includes(tag), tag)
  }
  assert.match(html, /<meta property="og:title" content="[^"]+" \/>/)
  assert.match(html, /property="og:description"\s+content="[^"]+"/)
  assert.match(html, /name="twitter:title" content="[^"]+"/)
  assert.match(html, /inteligência artificial e atendimento humano quando necessário/)
})
