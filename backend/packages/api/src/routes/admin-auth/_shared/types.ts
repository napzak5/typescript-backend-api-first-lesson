import type { operations } from '@beauty-salon-backend/generated'
import type { JsonBody } from '../../../shared/operation-types'

export type GetUserResponse = JsonBody<
  operations['AdminAuthCrud_getUser']['responses'][200]['content']
>
export type UnlockAccountResponse = JsonBody<
  operations['AdminAuthCrud_unlockAccount']['responses'][200]['content']
>
export type ResetTwoFactorResponse = JsonBody<
  operations['AdminAuthCrud_resetTwoFactor']['responses'][200]['content']
>
