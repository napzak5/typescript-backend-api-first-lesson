import {
  NOT_FOUND,
  unreadMessageOf,
  whyUnread,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsSalonResponse,
  ModelsSalonRoleType,
  ModelsStaffAccountResponse,
  ModelsStaffInvitationResponse,
  ModelsStaffResponse,
} from '@beauty-salon-frontend/api-client'
import { WithSalon } from '@beauty-salon-frontend/salon-screens'
import { useSession } from '@beauty-salon-frontend/session'
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  Dialog,
  type FormSays,
  LoadingIndicator,
  NO_CHANGE_MESSAGE,
  NOTHING_TO_SAY,
  UnreadNotice,
  useNotifications,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminStaffAccountMessages } from '@beauty-salon-shared/i18n/messages/admin'
import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { type Ref, useLayoutEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { match } from 'ts-pattern'
import {
  staffChangeHrefOf,
  staffMemberHrefOf,
  userAccountHrefOf,
} from '../../navigation'
import {
  STAFF_LISTS,
  type StaffRead,
  staffKeyOf,
} from '../../staff/api/staff-api'
import {
  StaffLedgerForbidden,
  useSignedInUserId,
  WithStaffMember,
} from '../../staff/screens/with-staff-member'
import { useAdministersAccounts } from '../../user-accounts/hooks/administers-accounts'
import {
  type AccountRead,
  accountKeyOf,
  attemptInvitation,
  changeRole,
  type InvitationRead,
  invitationKeyOf,
  readAccount,
  readInvitation,
  revokeInvitation,
  unlinkAccount,
} from '../api/accounts-api'
import { AccountRecord } from '../components/account-record/account-record'
import { InvitationRecord } from '../components/invitation-record/invitation-record'
import { RoleForm } from '../components/role-form/role-form'
import {
  afterInvitation,
  afterRevocation,
  afterRoleChange,
  afterUnlinking,
  readRole,
  readRoleChange,
} from '../utils/account-form'
import {
  isOwnAccount,
  type LoginShown,
  loginOf,
  roleDescriptionFor,
  rolesGivenBy,
} from '../utils/account-format'

const {
  title: TITLE,
  names,
  invite: INVITE,
  inactive: INACTIVE,
  revocation: REVOCATION,
  account: ACCOUNT,
  roleChange: ROLE_CHANGE,
  unlinking: UNLINKING,
} = adminStaffAccountMessages

/** What the parts of the screen are given: the member, and what the account that keeps them may do */
type PartProps = {
  salon: ModelsSalonResponse
  member: ModelsStaffResponse
  /** The roles the signed-in account may give */
  roles: ModelsSalonRoleType[]
  /** What the roles let an account do */
  description: LocalizedText
  /** The heading of the first card, which takes the focus when a write changed what is shown */
  headingRef: Ref<HTMLHeadingElement> | undefined
  /** What changed is shown: the heading of the first card takes the focus, and what happened meanwhile is said above */
  onMoved: (said?: LocalizedText) => void
}

/** Reads what the member has to sign in with anew, after the API said it was not what was shown. */
const readAnew = (
  queryClient: QueryClient,
  staffId: string,
): Promise<unknown> =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: accountKeyOf(staffId) }),
    queryClient.invalidateQueries({ queryKey: invitationKeyOf(staffId) }),
  ])

type InvitationFormProps = PartProps & {
  /** The invitation that is replaced; none for the first one */
  invitation?: ModelsStaffInvitationResponse | undefined
}

/**
 * The form that mails an invitation, or mails it again, to the address the
 * ledger has for the member. The API refuses an invitation of a member who
 * has an account, who is inactive, or who was invited less than a minute
 * ago in the same words: what is shown after it is what was read anew.
 */
const InvitationForm = ({
  salon,
  member,
  roles,
  description,
  headingRef,
  onMoved,
  invitation,
}: InvitationFormProps) => {
  const say = useSay()
  const queryClient = useQueryClient()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)
  const again = invitation !== undefined
  const invite = useMutation({
    mutationFn: (role: ModelsSalonRoleType) =>
      attemptInvitation(salon.id, member.id, role),
    onSuccess: async (attempt) =>
      match(afterInvitation(attempt, member.displayName, again))
        .with({ type: 'invited' }, ({ invitation: mailed, message }) => {
          const read: InvitationRead = { type: 'found', invitation: mailed }
          queryClient.setQueryData(invitationKeyOf(member.id), read)
          notify({ tone: 'success', message })
          onMoved()
        })
        .with({ type: 'accepted' }, ({ account, message }) => {
          const read: AccountRead = { type: 'found', account }
          queryClient.setQueryData(accountKeyOf(member.id), read)
          queryClient.setQueryData(invitationKeyOf(member.id), NOT_FOUND)
          // The member is linked to the account now
          void queryClient.invalidateQueries({
            queryKey: staffKeyOf(member.id),
          })
          onMoved(message)
        })
        .with({ type: 'inactive' }, ({ member: now, message }) => {
          const read: StaffRead = { type: 'found', member: now }
          queryClient.setQueryData(staffKeyOf(member.id), read)
          onMoved(message)
        })
        .with({ type: 'recent' }, async ({ says }) => {
          setSaid(says)
          await queryClient.invalidateQueries({
            queryKey: invitationKeyOf(member.id),
          })
        })
        .with({ type: 'gone' }, () => {
          queryClient.removeQueries({ queryKey: STAFF_LISTS })
          queryClient.setQueryData(staffKeyOf(member.id), NOT_FOUND)
        })
        .with({ type: 'again' }, ({ says }) => setSaid(says))
        .exhaustive(),
  })

  return (
    <Card
      title={say(again ? INVITE.titleAgain : INVITE.title)}
      headingRef={headingRef}
    >
      <RoleForm
        roles={roles}
        role={roles.find((role) => role === invitation?.role)}
        description={description}
        submitLabel={say(again ? INVITE.submitAgain : INVITE.submit)}
        message={said.message}
        errors={said.errors}
        pending={invite.isPending}
        onSubmit={(values) => {
          const read = readRole(values, roles)
          if (read.type === 'invalid') {
            setSaid({ message: undefined, errors: read.errors })
            return
          }
          setSaid(NOTHING_TO_SAY)
          invite.mutate(read.value)
        }}
      >
        <p>
          {say(again ? INVITE.toAgain(member.email) : INVITE.to(member.email))}
        </p>
      </RoleForm>
    </Card>
  )
}

/** What an inactive member is told instead of an invitation: the API invites active members alone. */
const InactiveNotice = ({
  salon,
  member,
}: Pick<PartProps, 'salon' | 'member'>) => {
  const say = useSay()

  return (
    <>
      <p>{say(INACTIVE.text)}</p>
      <ButtonLink href={staffChangeHrefOf(salon.id, member.id)}>
        {say(INACTIVE.toChange)}
      </ButtonLink>
    </>
  )
}

/** A member who has neither an account nor an invitation: an active one is invited. */
const NoLoginPart = (props: PartProps) => {
  const say = useSay()

  return (
    <>
      <p>{say(adminStaffAccountMessages.noLogin)}</p>
      {props.member.isActive ? (
        <InvitationForm {...props} />
      ) : (
        <InactiveNotice salon={props.salon} member={props.member} />
      )}
    </>
  )
}

type InvitationPartProps = PartProps & {
  invitation: ModelsStaffInvitationResponse
}

/** An invitation that was not taken yet: mailed again, or revoked after a dialog. */
const InvitationPart = ({ invitation, ...props }: InvitationPartProps) => {
  const { salon, member, headingRef, onMoved } = props
  const say = useSay()
  const queryClient = useQueryClient()
  const { notify } = useNotifications()
  const [revoking, setRevoking] = useState(false)
  /** What went wrong with an attempt that can be made again: said in the dialog */
  const [message, setMessage] = useState<LocalizedText>()
  const revocation = useMutation({
    mutationFn: () => revokeInvitation(salon.id, member.id),
    onSuccess: async (revoked) =>
      match(afterRevocation(revoked, member.displayName))
        .with({ type: 'done' }, ({ message: done }) => {
          queryClient.setQueryData(invitationKeyOf(member.id), NOT_FOUND)
          notify({ tone: 'success', message: done })
          onMoved()
        })
        .with({ type: 'gone' }, async ({ message: gone }) => {
          await readAnew(queryClient, member.id)
          setRevoking(false)
          onMoved(gone)
        })
        .with({ type: 'again' }, ({ message: again }) => setMessage(again))
        .exhaustive(),
  })

  const close = (): void => {
    setRevoking(false)
    setMessage(undefined)
  }

  return (
    <>
      <InvitationRecord
        invitation={invitation}
        member={member}
        now={new Date()}
        timezone={salon.timezone}
        headingRef={headingRef}
        actions={
          <Button variant='danger' onClick={() => setRevoking(true)}>
            {say(REVOCATION.button)}
          </Button>
        }
      />
      {member.isActive ? (
        <InvitationForm
          {...props}
          headingRef={undefined}
          invitation={invitation}
        />
      ) : (
        <InactiveNotice salon={salon} member={member} />
      )}
      <Dialog
        open={revoking}
        onClose={close}
        title={say(REVOCATION.title(member.displayName))}
        description={say(REVOCATION.description)}
        actions={
          <>
            <Button onClick={close}>{say(REVOCATION.back)}</Button>
            <Button
              variant='danger'
              pending={revocation.isPending}
              onClick={() => {
                setMessage(undefined)
                revocation.mutate()
              }}
            >
              {say(REVOCATION.confirm)}
            </Button>
          </>
        }
      >
        {message !== undefined && <Alert tone='danger'>{say(message)}</Alert>}
      </Dialog>
    </>
  )
}

type RoleChangeFormProps = PartProps & {
  account: ModelsStaffAccountResponse
}

/** The role of an account, changed to another the signed-in account may give. */
const RoleChangeForm = ({
  salon,
  member,
  roles,
  description,
  onMoved,
  account,
}: RoleChangeFormProps) => {
  const say = useSay()
  const queryClient = useQueryClient()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)
  const change = useMutation({
    mutationFn: (role: ModelsSalonRoleType) =>
      changeRole(salon.id, member.id, role),
    onSuccess: async (changed) =>
      match(afterRoleChange(changed, member.displayName))
        .with({ type: 'changed' }, ({ account: now, message }) => {
          const read: AccountRead = { type: 'found', account: now }
          queryClient.setQueryData(accountKeyOf(member.id), read)
          notify({ tone: 'success', message })
        })
        .with({ type: 'gone' }, async ({ message }) => {
          await readAnew(queryClient, member.id)
          onMoved(message)
        })
        .with({ type: 'again' }, ({ says }) => setSaid(says))
        .exhaustive(),
  })

  return (
    <Card title={say(ROLE_CHANGE.title)}>
      <RoleForm
        roles={roles}
        role={roles.find((role) => role === account.role)}
        description={
          account.role === 'owner' && !roles.includes('owner')
            ? adminStaffAccountMessages.roles.forOthersOfAnOwner
            : description
        }
        submitLabel={say(ROLE_CHANGE.title)}
        message={said.message}
        errors={said.errors}
        pending={change.isPending}
        onSubmit={(values) => {
          const read = readRoleChange(values, roles, account)
          if (read.type === 'invalid') {
            setSaid({ message: undefined, errors: read.errors })
            return
          }
          setSaid(NOTHING_TO_SAY)
          if (read.type === 'unchanged') {
            notify({ tone: 'info', message: NO_CHANGE_MESSAGE })
            return
          }
          change.mutate(read.value)
        }}
      >
        <p>{say(ROLE_CHANGE.note)}</p>
      </RoleForm>
    </Card>
  )
}

type AccountPartProps = PartProps & {
  account: ModelsStaffAccountResponse
}

/**
 * The account linked to a member: its role changed, or the account
 * unlinked after a dialog. The signed-in account may do neither to itself.
 * An administrator is led to the account itself, where its lock is lifted
 * and its second factor reset.
 */
const AccountPart = ({ account, ...props }: AccountPartProps) => {
  const { salon, member, headingRef, onMoved } = props
  const say = useSay()
  const queryClient = useQueryClient()
  const { notify } = useNotifications()
  const own = isOwnAccount(account, useSignedInUserId())
  const administers = useAdministersAccounts()
  const [unlinking, setUnlinking] = useState(false)
  /** What went wrong with an attempt that can be made again: said in the dialog */
  const [message, setMessage] = useState<LocalizedText>()
  const unlink = useMutation({
    mutationFn: () => unlinkAccount(salon.id, member.id),
    onSuccess: async (unlinked) =>
      match(afterUnlinking(unlinked, member.displayName))
        .with({ type: 'done' }, ({ message: done }) => {
          queryClient.setQueryData(accountKeyOf(member.id), NOT_FOUND)
          queryClient.setQueryData(invitationKeyOf(member.id), NOT_FOUND)
          // The member is linked to no account now
          void queryClient.invalidateQueries({
            queryKey: staffKeyOf(member.id),
          })
          queryClient.removeQueries({ queryKey: STAFF_LISTS })
          notify({ tone: 'success', message: done })
          onMoved()
        })
        .with({ type: 'gone' }, async ({ message: gone }) => {
          await readAnew(queryClient, member.id)
          setUnlinking(false)
          onMoved(gone)
        })
        .with({ type: 'again' }, ({ message: again }) => setMessage(again))
        .exhaustive(),
  })

  const close = (): void => {
    setUnlinking(false)
    setMessage(undefined)
  }

  return (
    <>
      {own && <p>{say(ACCOUNT.own)}</p>}
      {!member.isActive && <p>{say(ACCOUNT.inactiveMember)}</p>}
      <AccountRecord
        account={account}
        member={member}
        timezone={salon.timezone}
        headingRef={headingRef}
        actions={
          (administers || !own) && (
            <>
              {administers && (
                <ButtonLink href={userAccountHrefOf(account.id)}>
                  {say(ACCOUNT.toUserAccount)}
                </ButtonLink>
              )}
              {!own && (
                <Button variant='danger' onClick={() => setUnlinking(true)}>
                  {say(UNLINKING.button)}
                </Button>
              )}
            </>
          )
        }
      />
      {!own && (
        <>
          <RoleChangeForm {...props} account={account} />
          <Dialog
            open={unlinking}
            onClose={close}
            title={say(UNLINKING.title(member.displayName))}
            description={say(UNLINKING.description)}
            actions={
              <>
                <Button onClick={close}>{say(UNLINKING.back)}</Button>
                <Button
                  variant='danger'
                  pending={unlink.isPending}
                  onClick={() => {
                    setMessage(undefined)
                    unlink.mutate()
                  }}
                >
                  {say(UNLINKING.confirm)}
                </Button>
              </>
            }
          >
            {message !== undefined && (
              <Alert tone='danger'>{say(message)}</Alert>
            )}
          </Dialog>
        </>
      )}
    </>
  )
}

type LoginPartProps = {
  salon: ModelsSalonResponse
  member: ModelsStaffResponse
}

/**
 * Which part of the screen is shown, as far as the heading that takes the
 * focus goes: what the member has to sign in with, and whether they may be
 * invited.
 */
const partOf = (shown: LoginShown, member: ModelsStaffResponse): string =>
  `${shown.type}:${member.isActive ? 'active' : 'inactive'}`

/** A write that changed what is shown: the part it left to be shown, and how many writes did so far */
type Moved = { count: number; part: string }

/**
 * What a member has to sign in with: the account linked to them, else the
 * invitation they were mailed, else nothing yet. Both are read whenever the
 * screen opens, side by side: an invitation is taken outside the screen,
 * from the link of the mail.
 */
const LoginPart = ({ salon, member }: LoginPartProps) => {
  const say = useSay()
  const session = useSession()
  const role = session.type === 'signedIn' ? session.user.role : ''
  const account = useQuery({
    queryKey: accountKeyOf(member.id),
    queryFn: () => readAccount(salon.id, member.id),
    staleTime: 0,
  })
  const invitation = useQuery({
    queryKey: invitationKeyOf(member.id),
    queryFn: () => readInvitation(salon.id, member.id),
    staleTime: 0,
  })
  const queryClient = useQueryClient()
  const shown = loginOf(account.data, invitation.data)
  const part = partOf(shown, member)
  const heading = useRef<HTMLHeadingElement>(null)
  /**
   * The last write that changed what is shown. The heading of the first
   * card takes the focus once the part the write left is shown: what was
   * read anew reaches the screen after the write is done, and a heading
   * that is taken away with its part loses the focus.
   */
  const [moved, setMoved] = useState<Moved>({ count: 0, part })
  /** How many writes had the focus moved */
  const focused = useRef(0)
  /** What happened meanwhile, which the API told when the screen wrote: said above the cards */
  const [said, setSaid] = useState<LocalizedText>()

  useLayoutEffect(() => {
    if (moved.count > focused.current && moved.part === part) {
      focused.current = moved.count
      heading.current?.focus()
    }
  }, [moved, part])

  const props: PartProps = {
    salon,
    member,
    roles: rolesGivenBy(role),
    description: roleDescriptionFor(role),
    headingRef: heading,
    onMoved: (meanwhile) => {
      setSaid(meanwhile)
      const now = queryClient.getQueryData<StaffRead>(staffKeyOf(member.id))
      const left = partOf(
        loginOf(
          queryClient.getQueryData<AccountRead>(accountKeyOf(member.id)),
          queryClient.getQueryData<InvitationRead>(invitationKeyOf(member.id)),
        ),
        now?.type === 'found' ? now.member : member,
      )
      setMoved(({ count }) => ({ count: count + 1, part: left }))
    },
  }

  return (
    <>
      {said !== undefined && <Alert tone='warning'>{say(said)}</Alert>}
      {match(shown)
        .with({ type: 'loading' }, () => (
          <LoadingIndicator label={say(adminStaffAccountMessages.loading)} />
        ))
        .with({ type: 'forbidden' }, () => <StaffLedgerForbidden />)
        .with({ type: 'unread' }, ({ reads }) => (
          <UnreadNotice
            message={say(unreadMessageOf(names.account, whyUnread(reads)))}
            onRetry={() => {
              void account.refetch()
              void invitation.refetch()
            }}
            pending={account.isFetching || invitation.isFetching}
          />
        ))
        .with({ type: 'account' }, ({ account: linked }) => (
          <AccountPart {...props} account={linked} />
        ))
        .with({ type: 'invited' }, ({ invitation: mailed }) => (
          <InvitationPart {...props} invitation={mailed} />
        ))
        .with({ type: 'none' }, () => <NoLoginPart {...props} />)
        .exhaustive()}
      <ButtonLink href={staffMemberHrefOf(salon.id, member.id)}>
        {say(ACCOUNT.toMember)}
      </ButtonLink>
    </>
  )
}

/** The account a member of the staff ledger of the salon of the address signs in with, and the invitation that makes it. */
export const StaffAccountScreen = () => {
  const say = useSay()
  const { salonId = '', staffId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={say(TITLE)}>
      {(salon) => (
        <WithStaffMember
          key={staffId}
          salon={salon}
          title={say(TITLE)}
          fresh={false}
        >
          {(member) => <LoginPart salon={salon} member={member} />}
        </WithStaffMember>
      )}
    </WithSalon>
  )
}
