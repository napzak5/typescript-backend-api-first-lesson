/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MODE: "production" | "staging" | "development" | "test" | "localhost";
  readonly VITE_BACKEND_BASE_URL: string;
  readonly VITE_ADMIN_APP_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
