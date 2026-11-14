/** How the application treats the network in front of it and where its users find it. */
export type AppSettings = {
  /**
   * Reverse proxies between the clients and the server. The client address,
   * which the rate limit counts by, is read that many hops back in
   * `X-Forwarded-For`; 0 trusts the header not at all.
   */
  trustProxyHops: number
  cors: {
    /** Origins whose pages may call the API from a browser. */
    origins: string[]
    credentials: boolean
    /** How long a browser may cache the answer to a preflight request. */
    maxAgeSeconds: number
  }
  rateLimit: {
    windowMs: number
    /** Requests one client address may make per window. */
    maxRequests: number
  }
  /**
   * The origin of the web application. The links in mails point there; it
   * is configuration, so that a request cannot choose where they lead.
   */
  publicAppUrl: string
}
