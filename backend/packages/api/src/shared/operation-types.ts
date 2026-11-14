/** The JSON body among the contents of a response of a generated operation. */
export type JsonBody<Content> = Content extends {
  'application/json': infer Body
}
  ? Body
  : never

/**
 * The salon of a request to a route below a salon
 * (`/salons/:salonId/...`), from where the router is mounted.
 */
export type SalonParams = { salonId: string }
