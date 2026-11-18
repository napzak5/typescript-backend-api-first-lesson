import type { operations } from '@beauty-salon-backend/generated'
import type { JsonBody } from '../../../shared/operation-types'

export type GetSharedFileResponse = JsonBody<
  operations['SharedFileCrud_get']['responses'][200]['content']
>
export type IssueSharedFileDownloadUrlResponse = JsonBody<
  operations['SharedFileCrud_getDownloadUrl']['responses'][200]['content']
>
