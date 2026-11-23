import { Result } from '@beauty-salon-backend/utility'
import { asOneString, type LocalizedText } from '@beauty-salon-shared/i18n'
import { ruleMessages } from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { passwordOf } from '../../schemas/rules'
import { DomainErrors, parseStored, parseWith, type ValidationIssue } from '..'

const HEADLINE: LocalizedText = {
  en: 'Invalid visit',
  ja: '来店の内容が正しくありません',
}

const LATER: LocalizedText = {
  en: 'Must be later than from',
  ja: 'from より後にしてください',
}

const visitSchema = z.strictObject({
  name: z.string().max(5),
  guests: z.int().min(1),
  from: z.string(),
  to: z.string(),
})

const orderedVisitSchema = visitSchema.check((context) => {
  if (context.value.to <= context.value.from) {
    context.issues.push({
      code: 'custom',
      path: ['to'],
      message: asOneString(LATER),
      input: context.value.to,
    })
  }
})

const visit = { name: 'Hana', guests: 2, from: '09:00', to: '10:00' }

/** The issues of a refused input; none for an input that is taken. */
const issuesOf = (schema: z.ZodType, input: unknown): ValidationIssue[] => {
  const result = parseWith(schema, input, HEADLINE)

  return result.type === 'error' && result.error.type === 'validation'
    ? result.error.issues
    : []
}

describe('parseWith', () => {
  it('should give the value of an input that breaks no rule', () => {
    // Act
    const result = parseWith(orderedVisitSchema, visit, HEADLINE)

    // Assert
    expect(result).toEqual({ type: 'success', data: visit })
  })

  it('should report a broken rule under the headline it was given', () => {
    // Act
    const result = parseWith(visitSchema, { ...visit, guests: 0 }, HEADLINE)

    // Assert
    expect(result).toMatchObject({
      type: 'error',
      error: { type: 'validation', message: HEADLINE },
    })
  })

  it.each<[string, Record<string, unknown>, ValidationIssue]>([
    [
      'a value of another type',
      { name: 42 },
      {
        field: 'name',
        rule: 'invalid_type',
        message: {
          en: 'Invalid input: expected string, received number',
          ja: '無効な入力: stringが期待されましたが、数値が入力されました',
        },
      },
    ],
    [
      'a text that is too long',
      { name: 'Hanako' },
      {
        field: 'name',
        rule: 'too_big',
        message: {
          en: 'Too big: expected string to have <=5 characters',
          ja: '大きすぎる値: stringは5文字以下である必要があります',
        },
      },
    ],
    [
      'a number that is too small',
      { guests: 0 },
      {
        field: 'guests',
        rule: 'too_small',
        message: {
          en: 'Too small: expected number to be >=1',
          ja: '小さすぎる値: numberは1以上である必要があります',
        },
      },
    ],
  ])(
    'should say what Zod says of %s, in English and in Japanese',
    (_what, changed, issue) => {
      // Act
      const issues = issuesOf(visitSchema, { ...visit, ...changed })

      // Assert
      expect(issues).toEqual([issue])
    },
  )

  it('should read the message of a rule that a schema wrote in every language', () => {
    // Act
    const issues = issuesOf(orderedVisitSchema, { ...visit, to: '08:00' })

    // Assert
    expect(issues).toEqual([{ field: 'to', rule: 'custom', message: LATER }])
  })

  it('should tell a message that a schema wrote as a plain string as it is, in every language', () => {
    // Arrange
    const schema = z.string().regex(/^\d+$/, 'Must be digits')

    // Act
    const issues = issuesOf(schema, 'nine')

    // Assert
    expect(issues).toEqual([
      {
        field: '',
        rule: 'invalid_format',
        message: { en: 'Must be digits', ja: 'Must be digits' },
      },
    ])
  })

  it('should pair what the two checks say by the place of the issue', () => {
    // Arrange
    const schema = z.object({
      name: z.string().max(5),
      from: z.string().regex(/^\d\d:\d\d$/, asOneString(LATER)),
      guests: z.int(),
      to: z.string().regex(/^\d\d:\d\d$/, 'Must be a time'),
    })

    // Act
    const issues = issuesOf(schema, {
      name: 'Hanako',
      from: 'nine',
      guests: 1.5,
      to: 'ten',
    })

    // Assert
    expect(issues).toEqual([
      {
        field: 'name',
        rule: 'too_big',
        message: {
          en: 'Too big: expected string to have <=5 characters',
          ja: '大きすぎる値: stringは5文字以下である必要があります',
        },
      },
      { field: 'from', rule: 'invalid_format', message: LATER },
      {
        field: 'guests',
        rule: 'invalid_type',
        message: {
          en: 'Invalid input: expected int, received number',
          ja: '無効な入力: intが期待されましたが、数値が入力されました',
        },
      },
      {
        field: 'to',
        rule: 'invalid_format',
        message: { en: 'Must be a time', ja: 'Must be a time' },
      },
    ])
  })

  it('should report a property that is not known once for each, under its own name', () => {
    // Act
    const issues = issuesOf(z.object({ visit: visitSchema }), {
      visit: { ...visit, colour: 'red', table: 4 },
    })

    // Assert
    expect(issues).toEqual([
      {
        field: 'visit.colour',
        rule: 'unrecognized_keys',
        message: ruleMessages.unknownProperty,
      },
      {
        field: 'visit.table',
        rule: 'unrecognized_keys',
        message: ruleMessages.unknownProperty,
      },
    ])
  })

  it('should name the place of a value inside a list in dot notation', () => {
    // Act
    const issues = issuesOf(z.object({ visits: z.array(visitSchema) }), {
      visits: [visit, { ...visit, guests: 0 }],
    })

    // Assert
    expect(issues.map(({ field }) => field)).toEqual(['visits.1.guests'])
  })

  it.each<[string, string, ValidationIssue]>([
    [
      'too short',
      'short',
      {
        field: '',
        rule: 'too_small',
        message: {
          en: 'Too small: expected string to have >=8 characters',
          ja: '小さすぎる値: stringは8文字以上である必要があります',
        },
      },
    ],
    [
      'too long',
      'a'.repeat(129),
      {
        field: '',
        rule: 'too_big',
        message: {
          en: 'Too big: expected string to have <=128 characters',
          ja: '大きすぎる値: stringは128文字以下である必要があります',
        },
      },
    ],
  ])(
    'should say of a password that is %s what Zod says of such a text',
    (_what, password, issue) => {
      // Act
      const issues = issuesOf(passwordOf(8), password)

      // Assert
      expect(issues).toEqual([issue])
    },
  )
})

describe('parseStored', () => {
  const DESCRIPTION = 'Stored visit 7 does not match the API model'

  it('should give the value of what is stored and breaks no rule', () => {
    // Act
    const result = parseStored(orderedVisitSchema, visit, DESCRIPTION)

    // Assert
    expect(result).toEqual({ type: 'success', data: visit })
  })

  it('should give the value as the schema converts it', () => {
    // Arrange
    const schema = z.object({ guests: z.string().transform(Number) })

    // Act
    const result = parseStored(schema, { guests: '2' }, DESCRIPTION)

    // Assert
    expect(result).toEqual({ type: 'success', data: { guests: 2 } })
  })

  it('should answer what breaks a rule with a database error, which says what does not match and names the property and the rule', () => {
    // Act
    const result = parseStored(
      visitSchema,
      { ...visit, guests: 0 },
      DESCRIPTION,
    )

    // Assert
    expect(result).toEqual(
      Result.error(
        DomainErrors.database(DESCRIPTION, {
          issues: [
            {
              field: 'guests',
              rule: 'too_small',
              message: 'Too small: expected number to be >=1',
            },
          ],
        }),
      ),
    )
  })

  it('should say the message of a rule that a schema wrote in every language in English', () => {
    // Act
    const result = parseStored(
      orderedVisitSchema,
      { ...visit, to: '08:00' },
      DESCRIPTION,
    )

    // Assert
    expect(result).toEqual(
      Result.error(
        DomainErrors.database(DESCRIPTION, {
          issues: [{ field: 'to', rule: 'custom', message: LATER.en }],
        }),
      ),
    )
  })

  it('should name every property that breaks a rule, one inside a list by its place', () => {
    // Act
    const result = parseStored(
      z.object({ visits: z.array(visitSchema) }),
      { visits: [{ ...visit, name: 42 }, visit, { ...visit, guests: 0 }] },
      DESCRIPTION,
    )

    // Assert
    expect(result).toEqual(
      Result.error(
        DomainErrors.database(DESCRIPTION, {
          issues: [
            {
              field: 'visits.0.name',
              rule: 'invalid_type',
              message: 'Invalid input: expected string, received number',
            },
            {
              field: 'visits.2.guests',
              rule: 'too_small',
              message: 'Too small: expected number to be >=1',
            },
          ],
        }),
      ),
    )
  })

  it('should keep the value that is stored out of the cause', () => {
    // Arrange
    const schema = z.object({ email: z.email(), plan: z.enum(['basic']) })

    // Act
    const result = parseStored(
      schema,
      { email: 'hanako at example', plan: 'gold' },
      DESCRIPTION,
    )

    // Assert
    expect(result).toMatchObject({ type: 'error', error: { type: 'database' } })
    expect(JSON.stringify(result)).not.toMatch(/hanako|gold/)
  })
})
