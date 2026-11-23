import { bundledLibrary } from '@beauty-salon-shared/config/vite'
import manifest from './package.json' with { type: 'json' }

/*
 * What a language is and how one is chosen, which the backend and the
 * frontend read, and the messages, one module for each who says them: those
 * of the API, which the backend alone reads, and those of the screens. None
 * names anything a browser or Node.js brings, so the library runs in both.
 */
export default bundledLibrary(manifest, 'browser', {
  index: 'src/index.ts',
  'messages/api/index': 'src/messages/api/index.ts',
  'messages/ui/index': 'src/messages/ui/index.ts',
})
