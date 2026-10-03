import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'

const dir = join(process.cwd(), 'public', 'monsters')

function luma(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

function sat(r, g, b) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return max === 0 ? 0 : (max - min) / max
}

function dist(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

function grayish(r, g, b) {
  return sat(r, g, b) < 0.14 && luma(r, g, b) > 155
}

function learnChecker(data, w, h) {
  const acc0 = [0, 0, 0, 0]
  const acc1 = [0, 0, 0, 0]
  for (let i = 0; i < w * h; i++) {
    const o = i * 4
    const r = data[o]
    const g = data[o + 1]
    const b = data[o + 2]
    const a = data[o + 3]
    if (a > 24 && !grayish(r, g, b)) continue
    if (!grayish(r, g, b) && a > 24) continue
    const y = luma(r, g, b)
    const bucket = y > 220 ? acc1 : acc0
    bucket[0] += r
    bucket[1] += g
    bucket[2] += b
    bucket[3] += 1
  }
  const c0 = acc0[3] ? [acc0[0] / acc0[3], acc0[1] / acc0[3], acc0[2] / acc0[3]] : [204, 204, 204]
  const c1 = acc1[3] ? [acc1[0] / acc1[3], acc1[1] / acc1[3], acc1[2] / acc1[3]] : [242, 242, 242]
  return { c0, c1 }
}

function isCheckerPixel(r, g, b, c0, c1, loose = false) {
  if (!grayish(r, g, b)) return false
  const p = [r, g, b]
  const limit = loose ? 58 : 44
  return dist(p, c0) < limit || dist(p, c1) < limit || (luma(r, g, b) > 210 && sat(r, g, b) < 0.08)
}

function neighbors8(i, w, h) {
  const x = i % w
  const y = (i / w) | 0
  const out = []
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
      out.push(ny * w + nx)
    }
  }
  return out
}

function clean(data, w, h) {
  const { c0, c1 } = learnChecker(data, w, h)
  const hole = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const o = i * 4
    if (data[o + 3] < 20 || isCheckerPixel(data[o], data[o + 1], data[o + 2], c0, c1)) hole[i] = 1
  }

  // Grow checker holes into leftover JPEG fringe.
  for (let pass = 0; pass < 4; pass++) {
    const next = new Uint8Array(hole)
    for (let i = 0; i < w * h; i++) {
      if (hole[i]) continue
      const o = i * 4
      let n = 0
      for (const j of neighbors8(i, w, h)) if (hole[j]) n += 1
      if (n >= 3 && isCheckerPixel(data[o], data[o + 1], data[o + 2], c0, c1, true)) next[i] = 1
      else if (n >= 5 && luma(data[o], data[o + 1], data[o + 2]) > 175 && sat(data[o], data[o + 1], data[o + 2]) < 0.18) {
        next[i] = 1
      }
    }
    hole.set(next)
  }

  const alpha = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) alpha[i] = hole[i] ? 0 : data[i * 4 + 3]

  // Erode 1px so leftover fringe is not a hard rim.
  const eroded = new Uint8Array(alpha)
  for (let i = 0; i < w * h; i++) {
    if (alpha[i] === 0) continue
    let minA = alpha[i]
    for (const j of neighbors8(i, w, h)) minA = Math.min(minA, alpha[j])
    eroded[i] = minA
  }

  const out = Buffer.from(data)
  for (let i = 0; i < w * h; i++) {
    const o = i * 4
    const a = eroded[i]
    out[o + 3] = a
    if (a === 0) {
      out[o] = 0
      out[o + 1] = 0
      out[o + 2] = 0
    }
  }
  return out
}

async function feather(raw, w, h) {
  const alpha = Buffer.alloc(w * h)
  for (let i = 0; i < w * h; i++) alpha[i] = raw[i * 4 + 3]
  const blurred = await sharp(alpha, { raw: { width: w, height: h, channels: 1 } })
    .blur(1.6)
    .raw()
    .toBuffer()
  const out = Buffer.from(raw)
  for (let i = 0; i < w * h; i++) {
    const a = Math.min(raw[i * 4 + 3], blurred[i])
    out[i * 4 + 3] = a
    if (a === 0) {
      out[i * 4] = 0
      out[i * 4 + 1] = 0
      out[i * 4 + 2] = 0
    }
  }
  return out
}

const files = (await readdir(dir)).filter((name) => name.endsWith('.png'))
for (const name of files) {
  const src = join(dir, name)
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const cleaned = clean(data, info.width, info.height)
  const feathered = await feather(cleaned, info.width, info.height)
  await sharp(feathered, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(src)
  console.log(`cleaned ${name}`)
}
