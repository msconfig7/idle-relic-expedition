import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'supabase/functions/_shared')

await mkdir(outDir, { recursive: true })

await build({
  configFile: false,
  root,
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(root, 'src/lib/settleEntry.ts'),
      formats: ['es'],
      fileName: () => 'game-core.js',
    },
    outDir,
    sourcemap: false,
    minify: false,
  },
  logLevel: 'info',
})
