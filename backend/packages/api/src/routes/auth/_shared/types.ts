import type { operations } from '@beauty-salon-backend/generated'
import type { JsonBody } from '../../../shared/operation-types'

export type LoginResponse = JsonBody<
  operations['AuthCrud_login']['responses'][200]['content']
>
export type RefreshTokenResponse = JsonBody<
  operations['AuthCrud_refreshToken']['responses'][200]['content']
>
export type GetCurrentUserResponse = JsonBody<
  operations['AuthCrud_getCurrentUser']['responses'][200]['content']
>
