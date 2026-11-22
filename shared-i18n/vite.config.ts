import { bundledLibrary } from '@beauty-salon-shared/config/vite'
import manifest from './package.json' with { type: 'json' }

/*
 * Two modules: what a language is and how one is chosen, which the backend
 * and the frontend read, and the messages of the API, which the backend
 * alone reads. Neither names anything a browser or Node.js brings, so the
 * library runs in both.
 */
export default bundledLibrary(manifest, 'browser', {
  index: 'src/index.ts',
  'messages/api/index': 'src/messages/api/index.ts',
})
