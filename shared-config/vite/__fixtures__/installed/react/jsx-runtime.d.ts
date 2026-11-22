export namespace JSX {
  export type Element = string
  export interface IntrinsicElements {
    span: { children: string }
  }
}

export declare const jsx: (type: string, properties: object) => JSX.Element
