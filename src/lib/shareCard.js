// Story-sized (1080×1920) images to share on Instagram and the like: a revealed surprise,
// a milestone or a plan. Drawn on a canvas in the browser; nothing leaves the phone until shared.

const W = 1080
const H = 1920
const SERIF = 'Newsreader, Georgia, serif'
const SANS = 'Inter, system-ui, sans-serif'
const INK = '#24161f'
const DEEP = '#5b2f4a'
const MUTED = '#6c5f66'

// The app's fonts, but never wait more than two seconds for them (slow connection).
async function fontsReady() {
  const loading = Promise.all(
    ['600 96px Newsreader', '500 48px Newsreader', '400 40px Inter', '600 40px Inter'].map((f) =>
      document.fonts?.load(f).catch(() => {}),
    ),
  )
  await Promise.race([loading, new Promise((resolve) => setTimeout(resolve, 2000))])
}

// Photos come from storage links that allow other sites to read them, so the canvas stays exportable.
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

// Splits text into lines that fit the width; long words are kept whole.
function lines(ctx, text, width, max = 4) {
  const words = text.split(/\s+/)
  const out = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > width && line) {
      out.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) out.push(line)
  if (out.length > max) {
    out.length = max
    out[max - 1] = `${out[max - 1].replace(/\s*\S*$/, '')}…`
  }
  return out
}

// Draws centered text lines; returns the y below them.
function text(ctx, value, y, { font, color, lineHeight, width = 860, max }) {
  ctx.font = font
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  for (const line of lines(ctx, value, width, max)) {
    ctx.fillText(line, W / 2, y)
    y += lineHeight
  }
  return y
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

function background(ctx) {
  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, '#5a2a4e')
  g.addColorStop(0.55, '#4a2140')
  g.addColorStop(1, '#2c1426')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  // Soft light circles.
  for (const [x, y, r, a] of [
    [880, 260, 320, 0.35],
    [160, 1640, 380, 0.3],
    [980, 1500, 180, 0.25],
  ]) {
    ctx.fillStyle = `rgba(255,255,255,${a})`
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

// The photo fills the card; a dark fade at the bottom keeps the text readable.
function photoBackground(ctx, img) {
  const scale = Math.max(W / img.width, H / img.height)
  const w = img.width * scale
  const h = img.height * scale
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h)
  const g = ctx.createLinearGradient(0, H * 0.35, 0, H)
  g.addColorStop(0, 'rgba(40,28,48,0)')
  g.addColorStop(0.55, 'rgba(40,28,48,0.55)')
  g.addColorStop(1, 'rgba(40,28,48,0.85)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}

function footer(ctx, light) {
  ctx.font = `600 34px ${SANS}`
  ctx.fillStyle = light ? 'rgba(255,255,255,0.85)' : DEEP
  ctx.textAlign = 'center'
  ctx.fillText('💜 usday.app', W / 2, H - 110)
}

/**
 * card: {
 *   emoji, label,        // small line on top, e.g. 🎁 SÜRPRİZ
 *   headline,            // e.g. "Serhat Han bana sürpriz hazırladı"
 *   big,                 // optional big number, e.g. "1000"
 *   title, when, place,  // the plan
 *   photoUrl             // optional background photo
 * }
 */
export async function drawCard(card) {
  await fontsReady()
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const img = card.photoUrl ? await loadImage(card.photoUrl).catch(() => null) : null

  if (img) {
    photoBackground(ctx, img)
    let y = 1180
    y = text(ctx, `${card.emoji} ${card.label}`, y, { font: `600 38px ${SANS}`, color: 'rgba(255,255,255,0.9)', lineHeight: 70 })
    if (card.headline) y = text(ctx, card.headline, y + 10, { font: `500 50px ${SERIF}`, color: '#fff', lineHeight: 64, max: 2 })
    y = text(ctx, card.big ? `${card.big} ${card.title}` : card.title, y + 30, {
      font: `600 84px ${SERIF}`,
      color: '#fff',
      lineHeight: 96,
      max: 3,
    })
    text(ctx, [card.when, card.place].filter(Boolean).join(' · '), y + 20, {
      font: `400 38px ${SANS}`,
      color: 'rgba(255,255,255,0.85)',
      lineHeight: 52,
      max: 2,
    })
    footer(ctx, true)
  } else {
    background(ctx)
    // Lay the text out once without drawing to size the card around it, then draw it centered.
    const content = (top) => {
      let y = top + 180
      ctx.font = `120px ${SANS}`
      ctx.textAlign = 'center'
      ctx.fillText(card.emoji, W / 2, y)
      y = text(ctx, card.label, y + 90, { font: `600 36px ${SANS}`, color: DEEP, lineHeight: 60 })
      if (card.headline) y = text(ctx, card.headline, y + 10, { font: `500 50px ${SERIF}`, color: INK, lineHeight: 64, max: 2 })
      if (card.big) y = text(ctx, card.big, y + 150, { font: `600 220px ${SERIF}`, color: DEEP, lineHeight: 120 })
      y = text(ctx, card.title, y + 50, { font: `600 76px ${SERIF}`, color: INK, lineHeight: 90, max: 3 })
      const when = [card.when, card.place].filter(Boolean).join(' · ')
      if (when) y = text(ctx, when, y + 20, { font: `400 38px ${SANS}`, color: MUTED, lineHeight: 52, max: 2 })
      return y + 70
    }
    const fillText = ctx.fillText
    ctx.fillText = () => {}
    const height = content(0)
    ctx.fillText = fillText
    const top = Math.max(160, (H - height) / 2 - 60)

    ctx.save()
    ctx.shadowColor = 'rgba(20,8,16,0.35)'
    ctx.shadowBlur = 60
    ctx.shadowOffsetY = 20
    roundRect(ctx, 80, top, W - 160, height, 64)
    ctx.fillStyle = 'rgba(246,243,239,0.95)'
    ctx.fill()
    ctx.restore()
    content(top)
    footer(ctx, false)
  }

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}
