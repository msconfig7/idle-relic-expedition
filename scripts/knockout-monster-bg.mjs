import { readdir, unlink } from 'node:fs/promises'
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

function grayish(r, g, b) {
  const y = luma(r, g, b)
  return sat(r, g, b) < 0.1 && y > 165
}

function dist(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

function detectTile(data, w, h) {
  let best = { size: 16, score: -1, c0: [204, 204, 204], c1: [248, 248, 248] }
  for (const size of [8, 12, 16, 20, 24, 32, 40]) {
    const acc0 = [0, 0, 0, 0]
    const acc1 = [0, 0, 0, 0]
    const limitY = Math.min(h, size * 8)
    const limitX = Math.min(w, size * 8)
    for (let y = 0; y < limitY; y++) {
      for (let x = 0; x < limitX; x++) {
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

function knockout(data, w, h) {
  const { c0, c1, size } = detectTile(data, w, h)
  const isBgColor = (r, g, b) => {
    if (!grayish(r, g, b)) return false
    const p = [r, g, b]
    return dist(p, c0) < 42 || dist(p, c1) < 42
  }

  const alpha = new Uint8Array(w * h)
  alpha.fill(255)
  const seen = new Uint8Array(w * h)
  const stack = []
  const enqueue = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return
    const i = y * w + x
    if (seen[i]) return
    seen[i] = 1
    const o = i * 4
    if (isBgColor(data[o], data[o + 1], data[o + 2])) stack.push(i)
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
    alpha[i] = 0
    const x = i % w
    const y = (i / w) | 0
    enqueue(x + 1, y)
    enqueue(x - 1, y)
    enqueue(x, y + 1)
    enqueue(x, y - 1)
  }

  const out = Buffer.from(data)
  for (let i = 0; i < w * h; i++) {
    const o = i * 4
    if (alpha[i] === 0) {
      out[o + 3] = 0
      continue
    }
    const x = i % w
    const y = (i / w) | 0
    let bg = 0
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, -1],
      [1, -1],
      [-1, 1],
    ]) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
      if (alpha[ny * w + nx] === 0) bg += 1
    }
    if (bg >= 3 && isBgColor(data[o], data[o + 1], data[o + 2])) {
      out[o + 3] = 0
      continue
    }
    if (bg > 0) out[o + 3] = Math.max(0, 255 - bg * 48)
  }
  return { out, size, c0, c1 }
}

const files = (await readdir(dir)).filter((name) => name.endsWith('.jpg'))
for (const name of files) {
  const src = join(dir, name)
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { out, size } = knockout(data, info.width, info.height)
  const dest = join(dir, name.replace(/\.jpg$/i, '.png'))
  await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(dest)
  await unlink(src)
  console.log(`knocked out ${name} tile=${size} -> ${name.replace('.jpg', '.png')}`)
}
