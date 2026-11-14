import { spawn } from 'node:child_process'
import { watch } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Re-runs `pnpm generate` whenever a TypeSpec file changes, so the OpenAPI
 * document, the backend types and the frontend API client stay in step.
 *
 * `tsp compile --watch` is not enough on its own: it skips the OpenAPI
 * post-processing and everything that is generated from the OpenAPI document.
 *
 * Usage: node ./scripts/generate-watch.ts
 */
const specsDir = resolve(import.meta.dirname, '../specs')
const debounceMs = 200

let running = false
let rerunRequested = false
let timer: NodeJS.Timeout | undefined

const generate = (): void => {
  if (running) {
    rerunRequested = true
    return
  }
  running = true
  const child = spawn('pnpm', ['generate'], { stdio: 'inherit' })
  child.on('exit', (code) => {
    running = false
    console.log(
      code === 0
        ? '✅ Generated. Watching specs/**/*.tsp for changes...'
        : '❌ Generation failed. Fix the TypeSpec error above; still watching...',
    )
    if (rerunRequested) {
      rerunRequested = false
      generate()
    }
  })
}

watch(specsDir, { recursive: true }, (_event, filename) => {
  if (filename?.endsWith('.tsp') !== true) {
    return
  }
  clearTimeout(timer)
  timer = setTimeout(generate, debounceMs)
})

generate()
