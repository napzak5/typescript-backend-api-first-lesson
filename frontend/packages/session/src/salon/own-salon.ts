import { staffOwnProfileGet } from '@beauty-salon-frontend/api-client'
import { useQuery } from '@tanstack/react-query'
import { match, P } from 'ts-pattern'
import { useSession } from '../use-session'

/** The salon of a member of the staff, as the API answers it. */
export type OwnSalonRead =
  /** The account belongs to the staff of this salon */
  | { type: 'member'; salonId: string }
  /**
   * The account has the role of a salon and no salon reaches it: the member
   * of the staff it was linked to was removed, or the link was undone
   */
  | { type: 'none' }
  | { type: 'tooManyRequests' }
  | { type: 'failed' }

/** Which salons the screens of the account work on. */
export type OwnSalon =
  /** The operator of the platform: every salon, one chosen at a time */
  { type: 'platform' } | OwnSalonRead

/** The salon, and the way to read it again when it could not be read. */
export type OwnSalonState = {
  /** `undefined` while it is read */
  salon: OwnSalon | undefined
  readAgain: () => void
  readingAgain: boolean
}

/** The key the salon of the account is read under: what changes the account takes it away. */
export const OWN_SALON = ['account', 'salon']

const PLATFORM: OwnSalon = { type: 'platform' }
const NONE: OwnSalonRead = { type: 'none' }
const FAILED: OwnSalonRead = { type: 'failed' }

/**
 * The handler of `.exhaustive()`: an answer whose status the contract does
 * not name (a gateway in front of the API) is nothing to act on, like no
 * answer at all.
 */
const outsideTheContract = (): OwnSalonRead => FAILED

/**
 * Reads the salon of the member of the staff the account is linked to
 * (`GET /staff-profiles/me`). A member belongs to one salon.
 */
export const readOwnSalon = async (): Promise<OwnSalonRead> => {
  const answer = await staffOwnProfileGet().catch(() => null)

  return (
    match(answer)
      .returnType<OwnSalonRead>()
      .with({ status: 200 }, ({ data }) => ({
        type: 'member',
        salonId: data.data.salonId,
      }))
      // No salon reaches the account, or its member of the staff is gone
      .with({ status: P.union(403, 404) }, () => NONE)
      .with({ status: 429 }, () => ({ type: 'tooManyRequests' }))
      .with(P.union(null, { status: 401 }, { status: 500 }), () => FAILED)
      .exhaustive(outsideTheContract)
  )
}

const SALON_ROLES: readonly string[] = ['owner', 'manager', 'staff']

/**
 * The salon the screens of the signed-in account work on: every salon for
 * an administrator, the salon of the member of the staff for the roles of
 * a salon, and none for anybody else. Only the roles of a salon ask the API.
 */
export const useOwnSalon = (): OwnSalonState => {
  const session = useSession()
  const role = session.type === 'signedIn' ? session.user.role : undefined
  const member = role !== undefined && SALON_ROLES.includes(role)
  const read = useQuery({
    queryKey: OWN_SALON,
    queryFn: readOwnSalon,
    enabled: member,
  })
  const salon = match(role)
    .returnType<OwnSalon | undefined>()
    .with(undefined, () => undefined)
    .with('admin', () => PLATFORM)
    .with('customer', () => NONE)
    .with(P.union('owner', 'manager', 'staff'), () => read.data)
    .exhaustive()

  return {
    salon,
    readAgain: () => void read.refetch(),
    readingAgain: read.isFetching,
  }
}
