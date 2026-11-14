import { describe, expect, it } from 'vitest'
import { generateDefaultPaginationData, PaginationParamsSchema } from './index'

describe('PaginationParamsSchema', () => {
  it('should coerce numeric strings from a query string to numbers', () => {
    // Arrange
    const params = { page: '2', pageSize: '20' }

    // Act
    const result = PaginationParamsSchema.safeParse(params)

    // Assert
    expect(result).toMatchObject({
      success: true,
      data: { page: 2, pageSize: 20 },
    })
  })

  it('should keep numbers as they are', () => {
    // Arrange
    const params = { page: 3, pageSize: 50 }

    // Act
    const result = PaginationParamsSchema.safeParse(params)

    // Assert
    expect(result).toMatchObject({
      success: true,
      data: { page: 3, pageSize: 50 },
    })
  })

  it('should accept missing parameters', () => {
    // Act
    const result = PaginationParamsSchema.safeParse({})

    // Assert
    expect(result).toMatchObject({ success: true, data: {} })
  })

  it('should drop parameters it does not know', () => {
    // Arrange
    const params = { page: '1', sort: 'name' }

    // Act
    const result = PaginationParamsSchema.safeParse(params)

    // Assert
    expect(result.data).toEqual({ page: 1 })
  })

  it.each([
    { label: 'page', params: { page: 'first' } },
    { label: 'pageSize', params: { pageSize: 'many' } },
  ])('should reject a non-numeric $label', ({ params }) => {
    // Act
    const result = PaginationParamsSchema.safeParse(params)

    // Assert
    expect(result.success).toBe(false)
  })
})

describe('generateDefaultPaginationData', () => {
  it('should create an empty first page under the data key by default', () => {
    // Act
    const result = generateDefaultPaginationData()

    // Assert
    expect(result).toEqual({
      pagination: { page: 0, per_page: 0, total: 0 },
      data: [],
    })
  })

  it('should store the items under the given key', () => {
    // Act
    const result = generateDefaultPaginationData('salons')

    // Assert
    expect(result).toEqual({
      pagination: { page: 0, per_page: 0, total: 0 },
      salons: [],
    })
  })

  it('should create an independent object on every call', () => {
    // Arrange
    const first = generateDefaultPaginationData<string>()
    const second = generateDefaultPaginationData<string>()

    // Act
    first.data.push('s_1')
    first.pagination.total = 1

    // Assert
    expect(second).toEqual({
      pagination: { page: 0, per_page: 0, total: 0 },
      data: [],
    })
  })
})
