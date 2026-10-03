import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'

const srcDir = join(
  process.env.USERPROFILE ?? '',
  '.cursor',
  'projects',
  'c-Users-Memo-idle-relic-expedition',
  'assets',
)
const destDir = join(process.cwd(), 'public', 'monsters')

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
  return sat(r, g, b) < 0.1 && luma(r, g, b) > 165
}

function detectTile(data, w, h) {
  let best = { size: 16, score: -1, c0: [210, 210, 210], c1: [250, 250, 250] }
  for (const size of [8, 12, 16, 20, 24, 32, 40]) {
    const acc0 = [0, 0, 0, 0]
    const acc1 = [0, 0, 0, 0]
    const band = Math.min(h, size * 8)
    const wide = Math.min(w, size * 8)
    for (let y = 0; y < band; y++) {
      for (let x = 0; x < wide; x++) {
        const i = (y * w + x) * 4
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        if (!grayish(r, g, b)) continue
        const bucket = (Math.floor(x / size) + Math.floor(y / size)) % 2 ? acc1 : acc0
        bucket[0] += r
        bucket[1] += g
        bucket[2] += b
        bucket[3] += 1
      }
    }
    if (acc0[3] < 80 || acc1[3] < 80) continue
    const c0 = [acc0[0] / acc0[3], acc0[1] / acc0[3], acc0[2] / acc0[3]]
    const c1 = [acc1[0] / acc1[3], acc1[1] / acc1[3], acc1[2] / acc1[3]]
    const sep = dist(c0, c1)
    const score = sep * Math.min(acc0[3], acc1[3])
    if (sep > 10 && score > best.score) best = { size, score, c0, c1 }
  }
  return best
}

function isBgColor(r, g, b, c0, c1) {
  if (!grayish(r, g, b)) return false
  const p = [r, g, b]
  return dist(p, c0) < 42 || dist(p, c1) < 42
}

function floodFromBorder(data, w, h, c0, c1) {
  const bg = new Uint8Array(w * h)
  const seen = new Uint8Array(w * h)
  const stack = []
  const enqueue = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return
    const i = y * w + x
    if (seen[i]) return
    seen[i] = 1
    const o = i * 4
    if (isBgColor(data[o], data[o + 1], data[o + 2], c0, c1)) stack.push(i)
  }
  for (let x = 0; x < w; x++) {
    enqueue(x, 0)
    enqueue(x, h - 1)
  }
  for (let y = 0; y < h; y++) {
    enqueue(0, y)
    enqueue(w - 1, y)
  }
  while (stack.length) {
    const i = stack.pop()
    bg[i] = 1
    const x = i % w
    const y = (i / w) | 0
    enqueue(x + 1, y)
    enqueue(x - 1, y)
    enqueue(x, y + 1)
    enqueue(x, y - 1)
  }
  return bg
}

function fillEnclosedHoles(data, bg, w, h, c0, c1, size) {
  const seen = new Uint8Array(w * h)
  const out = Uint8Array.from(bg)
  for (let start = 0; start < w * h; start++) {
    if (out[start] || seen[start]) continue
    const o = start * 4
    if (!isBgColor(data[o], data[o + 1], data[o + 2], c0, c1)) continue
    const comp = []
    const stack = [start]
    seen[start] = 1
    while (stack.length) {
      const i = stack.pop()
      comp.push(i)
      const x = i % w
      const y = (i / w) | 0
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const ni = ny * w + nx
        if (seen[ni] || out[ni]) continue
        const no = ni * 4
        if (!isBgColor(data[no], data[no + 1], data[no + 2], c0, c1)) continue
        seen[ni] = 1
        stack.push(ni)
      }
    }
    if (comp.length < 8) continue
    let agree0 = 0
    let agree1 = 0
    let lumaSum = 0
    for (const i of comp) {
      const x = i % w
      const y = (i / w) | 0
      const r = data[i * 4]
      const g = data[i * 4 + 1]
      const b = data[i * 4 + 2]
      lumaSum += luma(r, g, b)
      const p = [r, g, b]
      const near1 = dist(p, c1) < dist(p, c0)
      const phase = (Math.floor(x / size) + Math.floor(y / size)) % 2 === 1
      if (near1 === phase) agree0 += 1
      else agree1 += 1
    }
    const agreement = Math.max(agree0, agree1) / comp.length
    const meanY = lumaSum / comp.length
    if (meanY >= 188 && agreement >= 0.68) {
      for (const i of comp) out[i] = 1
    }
  }
  return out
}

function fringe(data, bg, w, h, c0, c1) {
  const out = Uint8Array.from(bg)
  for (let i = 0; i < w * h; i++) {
    if (bg[i]) continue
    const o = i * 4
    if (!isBgColor(data[o], data[o + 1], data[o + 2], c0, c1)) continue
    const x = i % w
    const y = (i / w) | 0
    let n = 0
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        if (bg[ny * w + nx]) n += 1
      }
    }
    if (n >= 4) out[i] = 1
  }
  return out
}

function applyMask(data, bg, w, h) {
  const out = Buffer.alloc(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    const o = i * 4
    if (bg[i]) {
      out[o] = 0
      out[o + 1] = 0
      out[o + 2] = 0
      out[o + 3] = 0
    } else {
      out[o] = data[o]
      out[o + 1] = data[o + 1]
      out[o + 2] = data[o + 2]
      out[o + 3] = 255
    }
  }
  return out
}

function feather(raw, w, h) {
  const out = Buffer.from(raw)

  // Feather inward only. This keeps every cleared gap transparent while
  // softening the cutout edge without inventing a colored halo.
  for (let i = 0; i < w * h; i++) {
    if (raw[i * 4 + 3] === 0) continue
    const x = i % w
    const y = (i / w) | 0
    let nearestTransparent = 3
    for (let radius = 1; radius <= 2; radius++) {
      let found = false
      for (let dy = -radius; dy <= radius && !found; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          if (raw[(ny * w + nx) * 4 + 3] === 0) {
            nearestTransparent = radius
            found = true
            break
          }
        }
      }
      if (found) break
    }
    if (nearestTransparent === 1) out[i * 4 + 3] = 150
    else if (nearestTransparent === 2) out[i * 4 + 3] = 225
  }
  return out
}

function removeNeutralSpots(raw, w, h, id) {
  if (id !== 'crypt-guard' && id !== 'vault-wraith') return raw
  const out = Buffer.from(raw)
  for (let i = 0; i < w * h; i++) {
    const x = i % w
    const y = (i / w) | 0
    const o = i * 4
    if (out[o + 3] === 0) continue
    const inCryptGap =
      id === 'crypt-guard' && x >= 270 && x <= 425 && y >= 420 && y <= 950
    const inWraith = id === 'vault-wraith'
    if (!inCryptGap && !inWraith) continue
    if (sat(out[o], out[o + 1], out[o + 2]) < 0.1 && luma(out[o], out[o + 1], out[o + 2]) > 172) {
      out[o] = 0
      out[o + 1] = 0
      out[o + 2] = 0
      out[o + 3] = 0
    }
  }
  return out
}

const sources = (await readdir(srcDir)).filter((name) => name.startsWith('monster-') && name.endsWith('.jpg'))
for (const name of sources) {
  const id = name.replace(/^monster-/, '').replace(/\.jpg$/i, '')
  const { data, info } = await sharp(join(srcDir, name)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { c0, c1, size } = detectTile(data, info.width, info.height)
  let bg = floodFromBorder(data, info.width, info.height, c0, c1)
  bg = fillEnclosedHoles(data, bg, info.width, info.height, c0, c1, size)
  bg = fringe(data, bg, info.width, info.height, c0, c1)
  const knocked = applyMask(data, bg, info.width, info.height)
  const feathered = feather(knocked, info.width, info.height)
  const cleaned = removeNeutralSpots(feathered, info.width, info.height, id)
  await sharp(cleaned, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(join(destDir, `${id}.png`))
  console.log(`recut ${id}.png tile=${size}`)
}
