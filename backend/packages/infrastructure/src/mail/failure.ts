import { match, P } from 'ts-pattern'

/**
 * What a failed delivery leaves for the log: the stage of the SMTP dialogue
 * and the server's verdict, never the message or its recipient.
 */
export const describeMailFailure = (error: unknown) => ({
  message: match(error)
    .with({ message: P.string }, ({ message }) => message)
    .otherwise(() => 'Mail delivery failed'),
  code: match(error)
    .with({ code: P.string }, ({ code }) => code)
    .otherwise(() => null),
  command: match(error)
    .with({ command: P.string }, ({ command }) => command)
    .otherwise(() => null),
  responseCode: match(error)
    .with({ responseCode: P.number }, ({ responseCode }) => responseCode)
    .otherwise(() => null),
})
