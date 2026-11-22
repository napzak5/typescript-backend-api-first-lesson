declare module 'node:os' {
  export const hostname: () => string
}

interface ImportMeta {
  readonly env: Record<string, string>
}
