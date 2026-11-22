declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}

declare module '*?raw' {
  const text: string
  export default text
}

interface ImportMeta {
  readonly env: Record<string, string>
}
