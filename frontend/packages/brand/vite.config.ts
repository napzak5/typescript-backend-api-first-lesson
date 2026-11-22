import { bundledLibrary } from '@beauty-salon-shared/config/vite'
import manifest from './package.json' with { type: 'json' }

/*
 * Two modules: the names of the applications, which their pages read, and
 * the plugin of Vite, which their builds run in Node.js. The plugin finds
 * the images of `public/` next to `dist/`, as it finds them next to `src/`.
 */
export default bundledLibrary(manifest, 'node', {
  index: 'src/index.ts',
  vite: 'src/vite.ts',
})
