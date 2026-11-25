import { bundledLibrary } from '@beauty-salon-shared/config/vite'
import manifest from './package.json' with { type: 'json' }

export default bundledLibrary(manifest, 'node')
