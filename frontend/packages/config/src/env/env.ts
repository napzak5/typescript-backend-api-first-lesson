export type RuntimeMode =
  | 'production'
  | 'staging'
  | 'development'
  | 'test'
  | 'localhost'

export const env = {
  VITE_MODE: {
    /**
     * @see https://vitejs.dev/guide/env-and-mode.html#modes
     */
    description: '実行時のモードになります',
    value: import.meta.env.MODE,
  },
  VITE_APP_TITLE: {
    description: 'アプリ名になります',
    value: import.meta.env.VITE_APP_TITLE,
  },
  VITE_BACKEND_BASE_URL: {
    description: 'APIサーバーのオリジンになります',
    value: import.meta.env.VITE_BACKEND_BASE_URL,
  },
}
