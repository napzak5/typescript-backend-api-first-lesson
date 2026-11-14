/** The JSON body among the contents of a response of a generated operation. */
export type JsonBody<Content> = Content extends {
  'application/json': infer Body
}
  ? Body
  : never
