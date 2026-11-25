import type { AddressInfo, Server } from 'node:net'

/** The servers of the tests listen on this machine only. */
export const LOOPBACK = '127.0.0.1'

/**
 * Listens on a port of this machine, a free one unless one is named; the
 * port it listens on. Rejects when the port is taken.
 */
export const listen = (server: Server, port = 0): Promise<number> =>
  new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, LOOPBACK, () => {
      const address: AddressInfo | string | null = server.address()
      if (address === null || typeof address === 'string') {
        reject(new Error('The server listens on no port'))
        return
      }
      resolve(address.port)
    })
  })
