import { bundledLibrary } from '@beauty-salon-shared/config/vite'
import manifest from './package.json' with { type: 'json' }

/*
 * What a language is and how one is chosen, and how a value is written in
 * each, which the backend and the frontend read, and the messages, one
 * module for each who says them: those of the API, which the backend alone
 * reads, those of the shared parts of the screens, and those of each
 * application. None names anything a browser or Node.js brings (`Intl` is
 * a part of the language), so the library runs in both.
 */
export default bundledLibrary(manifest, 'browser', {
  index: 'src/index.ts',
  'formats/index': 'src/formats/index.ts',
  'messages/api/index': 'src/messages/api/index.ts',
  'messages/ui/index': 'src/messages/ui/index.ts',
  'messages/portal/index': 'src/messages/portal/index.ts',
  'messages/dashboard/index': 'src/messages/dashboard/index.ts',
})
