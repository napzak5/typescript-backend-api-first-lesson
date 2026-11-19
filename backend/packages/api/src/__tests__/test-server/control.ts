import { createHash, timingSafeEqual } from 'node:crypto'
import express, { type Express } from 'express'
import { match } from 'ts-pattern'
import { z } from 'zod'
import { stepAt, totp } from '../_shared/two-factor-helpers'
import type { TestApis } from './test-apis'

const apiSchema = z.strictObject({
  /** The port the API listens on, or `null` for a free one */
  port: z.union([z.int().min(1).max(65_535), z.null()]),
  /** The origins whose pages may call the API from a browser */
  corsOrigins: z.array(z.string().regex(/^https?:\/\/[^/]+$/)),
})

const statementSchema = z.strictObject({
  text: z.string().min(1),
  values: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])),
})

const authenticatorSchema = z.strictObject({
  /** The secret of the authenticator app, in Base32 */
  secret: z.string().regex(/^[A-Z2-7]+$/),
  /** How many steps of 30 seconds after the current one the code is for */
  stepsAhead: z.union([z.literal(0), z.literal(1)]),
})

const digest = (text: string): Buffer =>
  createHash('sha256').update(text).digest()

/**
 * What the tests ask the test server for, over HTTP:
 *
 * - `POST /apis` starts an API for `{ port, corsOrigins }` and answers 201
 *   with its `id`, its `origin` and `seedPassword`, the password of the
 *   accounts of the seed data. `port` is the port to listen on, or `null`
 *   for a free one; `corsOrigins` are the origins whose pages may call the
 *   API from a browser. It answers 409 when the port is taken
 * - `POST /apis/{id}/reset` gives it a fresh database (204)
 * - `POST /apis/{id}/query` runs `{ text, values }` on its database and
 *   answers with `{ rows }`: for what a test cannot bring about through the
 *   API, such as time having passed
 * - `DELETE /apis/{id}` stops it and drops its database (204)
 * - `POST /authenticator-codes` answers `{ secret, stepsAhead }` with
 *   `{ code }`, the code an authenticator app shows for the secret now
 *   (`stepsAhead: 0`) or in the next 30 seconds (`1`): a test has no such app
 *
 * Every request carries `Authorization: Bearer <token>`, the token that the
 * server was started with: a statement runs with the rights of the database
 * role of the tests, so only the process that started the server may send
 * one. A page in a browser cannot send that header to another origin, for
 * this application answers no preflight request: `corsOrigins` opens an API
 * to the pages of the applications under test, never this application.
 */
export const createControl = (
  apis: TestApis,
  token: string,
  seedPassword: string,
): Express => {
  const expected = digest(`Bearer ${token}`)
  const control = express()

  control.use((req, res, next) => {
    if (!timingSafeEqual(digest(req.get('authorization') ?? ''), expected)) {
      res.sendStatus(401)
      return
    }
    next()
  })
  control.use(express.json())

  control.post('/apis', async (req, res) => {
    const asked = apiSchema.safeParse(req.body)
    if (!asked.success) {
      res.status(400).json({ issues: asked.error.issues })
      return
    }

    match(await apis.create(asked.data))
      .with({ type: 'created' }, ({ id, origin }) =>
        res.status(201).json({ id, origin, seedPassword }),
      )
      .with({ type: 'notListening' }, ({ message }) =>
        res.status(409).json({ message }),
      )
      .exhaustive()
  })

  control.post('/apis/:id/reset', async (req, res) => {
    res.sendStatus((await apis.reset(req.params.id)) ? 204 : 404)
  })

  control.post('/apis/:id/query', async (req, res) => {
    const statement = statementSchema.safeParse(req.body)
    if (!statement.success) {
      res.status(400).json({ issues: statement.error.issues })
      return
    }
    const outcome = await apis.query(
      req.params.id,
      statement.data.text,
      statement.data.values,
    )

    match(outcome)
      .with({ type: 'rows' }, ({ rows }) => res.json({ rows }))
      .with({ type: 'unknownApi' }, () => res.sendStatus(404))
      .with({ type: 'refused' }, ({ message }) =>
        res.status(400).json({ message }),
      )
      .exhaustive()
  })

  control.delete('/apis/:id', async (req, res) => {
    res.sendStatus((await apis.remove(req.params.id)) ? 204 : 404)
  })

  control.post('/authenticator-codes', (req, res) => {
    const asked = authenticatorSchema.safeParse(req.body)
    if (!asked.success) {
      res.status(400).json({ issues: asked.error.issues })
      return
    }
    const { secret, stepsAhead } = asked.data

    res.json({ code: totp(secret, stepAt() + stepsAhead) })
  })

  return control
}
