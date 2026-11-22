import { describe, expect, it } from 'vitest'
import { CustomerDeletionRequestWriteMapper } from '../write/customer-deletion-request.mapper'

describe('CustomerDeletionRequestWriteMapper.fromCreateRequest', () => {
  it('takes the reason as it is written', () => {
    expect(
      CustomerDeletionRequestWriteMapper.fromCreateRequest({
        reason: '  引っ越しのため、データの消去を希望します  ',
      }),
    ).toStrictEqual({ reason: '  引っ越しのため、データの消去を希望します  ' })
  })
})
