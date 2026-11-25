import { describe, expect, it } from 'vitest'
import { describeMailFailure } from '../failure'

describe('describeMailFailure', () => {
  it('should describe a refusal of the server by the stage of the dialogue and the verdict', () => {
    // Arrange
    const refused = Object.assign(
      new Error("Can't send mail - all recipients were rejected"),
      { code: 'EENVELOPE', command: 'RCPT TO', responseCode: 550 },
    )

    // Act
    const description = describeMailFailure(refused)

    // Assert
    expect(description).toEqual({
      message: "Can't send mail - all recipients were rejected",
      code: 'EENVELOPE',
      command: 'RCPT TO',
      responseCode: 550,
    })
  })

  it('should describe a failure before the dialogue by its code alone', () => {
    // Arrange
    const unreachable = Object.assign(
      new Error('connect ECONNREFUSED 127.0.0.1:587'),
      { code: 'ESOCKET' },
    )

    // Act
    const description = describeMailFailure(unreachable)

    // Assert
    expect(description).toEqual({
      message: 'connect ECONNREFUSED 127.0.0.1:587',
      code: 'ESOCKET',
      command: null,
      responseCode: null,
    })
  })

  it('should describe something that is not an error', () => {
    // Arrange
    const thrown = 'boom'

    // Act
    const description = describeMailFailure(thrown)

    // Assert
    expect(description).toEqual({
      message: 'Mail delivery failed',
      code: null,
      command: null,
      responseCode: null,
    })
  })
})
