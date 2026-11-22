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
  LoadingIndicator,
  UnreadNotice,
  useNotifications,
} from '@beauty-salon-frontend/ui'
import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { type Ref, useLayoutEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { match } from 'ts-pattern'
import type { FormSays } from '../bookings/booking-entry'
import {
  staffChangeHrefOf,
  staffMemberHrefOf,
  userAccountHrefOf,
} from '../navigation'
import { STAFF_LISTS, type StaffRead, staffKeyOf } from '../staff/staff-api'
import { staffCalled } from '../staff/staff-format'
import {
  StaffLedgerForbidden,
  useSignedInUserId,
  WithStaffMember,
} from '../staff/with-staff-member'
import { useAdministersAccounts } from '../user-accounts/administers-accounts'
import {
  afterInvitation,
  afterRevocation,
  afterRoleChange,
  afterUnlinking,
  readRole,
  readRoleChange,
} from './account-form'
import {
  isOwnAccount,
  type LoginShown,
  loginOf,
  roleDescriptionFor,
  rolesGivenBy,
} from './account-format'
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
} from './accounts-api'
import { AccountRecord } from './components/account-record/account-record'
import { InvitationRecord } from './components/invitation-record/invitation-record'
import { RoleForm } from './components/role-form/role-form'

const TITLE = 'ログインアカウント'

const NOTHING_SAID: FormSays = { message: undefined, errors: {} }

/** What the parts of the screen are given: the member, and what the account that keeps them may do */
type PartProps = {
  salon: ModelsSalonResponse
  member: ModelsStaffResponse
  /** The roles the signed-in account may give */
  roles: ModelsSalonRoleType[]
  /** What the roles let an account do */
  description: string
  /** The heading of the first card, which takes the focus when a write changed what is shown */
  headingRef: Ref<HTMLHeadingElement> | undefined
  /** What changed is shown: the heading of the first card takes the focus, and what happened meanwhile is said above */
  onMoved: (said?: string) => void
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
  const queryClient = useQueryClient()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays>(NOTHING_SAID)
  const called = staffCalled(member)
  const again = invitation !== undefined
  const invite = useMutation({
    mutationFn: (role: ModelsSalonRoleType) =>
      attemptInvitation(salon.id, member.id, role),
    onSuccess: async (attempt) =>
      match(afterInvitation(attempt, called, again))
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
    <Card title={again ? '招待し直す' : '招待する'} headingRef={headingRef}>
      <RoleForm
        roles={roles}
        role={roles.find((role) => role === invitation?.role)}
        description={description}
        submitLabel={again ? '招待メールを送り直す' : '招待メールを送る'}
        message={said.message}
        errors={said.errors}
        pending={invite.isPending}
        onSubmit={(values) => {
          const read = readRole(values, roles)
          if (read.type === 'invalid') {
            setSaid({ message: undefined, errors: read.errors })
            return
          }
          setSaid(NOTHING_SAID)
          invite.mutate(read.request)
        }}
      >
        <p>
          {again
            ? `招待メールを、台帳のメールアドレス（${member.email}）に送り直します。前に送ったメールのリンクは、使えなくなります。`
            : `招待メールを、台帳のメールアドレス（${member.email}）に送ります。宛先を変えるときは、先にスタッフ情報を直してください。`}
          招待のリンクは、7 日の間、使えます。
        </p>
      </RoleForm>
    </Card>
  )
}

/** What an inactive member is told instead of an invitation: the API invites active members alone. */
const InactiveNotice = ({
  salon,
  member,
}: Pick<PartProps, 'salon' | 'member'>) => (
  <>
    <p>
      無効なスタッフは、招待できません。休職や退職の手続きが終わって復帰するときは、スタッフ情報を有効に戻してから招待してください。
    </p>
    <ButtonLink href={staffChangeHrefOf(salon.id, member.id)}>
      スタッフ情報を直す
    </ButtonLink>
  </>
)

/** A member who has neither an account nor an invitation: an active one is invited. */
const NoLoginPart = (props: PartProps) => (
  <>
    <p>
      ログインアカウントは、まだありません。招待すると、招待メールのリンクから、スタッフご本人がパスワードを決めて、ログインアカウントを作ります。
    </p>
    {props.member.isActive ? (
      <InvitationForm {...props} />
    ) : (
      <InactiveNotice salon={props.salon} member={props.member} />
    )}
  </>
)

type InvitationPartProps = PartProps & {
  invitation: ModelsStaffInvitationResponse
}

/** An invitation that was not taken yet: mailed again, or revoked after a dialog. */
const InvitationPart = ({ invitation, ...props }: InvitationPartProps) => {
  const { salon, member, headingRef, onMoved } = props
  const queryClient = useQueryClient()
  const { notify } = useNotifications()
  const [revoking, setRevoking] = useState(false)
  /** What went wrong with an attempt that can be made again: said in the dialog */
  const [message, setMessage] = useState<string>()
  const called = staffCalled(member)
  const revocation = useMutation({
    mutationFn: () => revokeInvitation(salon.id, member.id),
    onSuccess: async (revoked) =>
      match(afterRevocation(revoked, called))
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
            招待を取り消す
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
        title={`${called}への招待を取り消しますか？`}
        description='取り消すと、送った招待メールのリンクは使えなくなります。あとで、また招待できます。'
        actions={
          <>
            <Button onClick={close}>戻る</Button>
            <Button
              variant='danger'
              pending={revocation.isPending}
              onClick={() => {
                setMessage(undefined)
                revocation.mutate()
              }}
            >
              取り消す
            </Button>
          </>
        }
      >
        {message !== undefined && <Alert tone='danger'>{message}</Alert>}
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
  const queryClient = useQueryClient()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays>(NOTHING_SAID)
  const called = staffCalled(member)
  const change = useMutation({
    mutationFn: (role: ModelsSalonRoleType) =>
      changeRole(salon.id, member.id, role),
    onSuccess: async (changed) =>
      match(afterRoleChange(changed, called))
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
    <Card title='ロールを変える'>
      <RoleForm
        roles={roles}
        role={roles.find((role) => role === account.role)}
        description={
          account.role === 'owner' && !roles.includes('owner')
            ? `${description}オーナーのロールを外すと、戻せるのは管理者だけです。`
            : description
        }
        submitLabel='ロールを変える'
        message={said.message}
        errors={said.errors}
        pending={change.isPending}
        onSubmit={(values) => {
          const read = readRoleChange(values, roles, account)
          if (read.type === 'invalid') {
            setSaid({ message: undefined, errors: read.errors })
            return
          }
          setSaid(NOTHING_SAID)
          if (read.type === 'unchanged') {
            notify({ tone: 'info', message: '変更はありませんでした。' })
            return
          }
          change.mutate(read.request)
        }}
      >
        <p>ロールの変更は、そのアカウントの次の操作から効きます。</p>
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
  const queryClient = useQueryClient()
  const { notify } = useNotifications()
  const own = isOwnAccount(account, useSignedInUserId())
  const administers = useAdministersAccounts()
  const [unlinking, setUnlinking] = useState(false)
  /** What went wrong with an attempt that can be made again: said in the dialog */
  const [message, setMessage] = useState<string>()
  const called = staffCalled(member)
  const unlink = useMutation({
    mutationFn: () => unlinkAccount(salon.id, member.id),
    onSuccess: async (unlinked) =>
      match(afterUnlinking(unlinked, called))
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
      {own && (
        <p>
          ご自身のアカウントです。このアカウントからは、ロールを変えることも、紐づけを解除することもできません。
        </p>
      )}
      {!member.isActive && (
        <p>
          無効なスタッフです。スタッフ情報を有効に戻すまで、このアカウントでは、サロンの画面を使えません。
        </p>
      )}
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
                  アカウントの状態を見る
                </ButtonLink>
              )}
              {!own && (
                <Button variant='danger' onClick={() => setUnlinking(true)}>
                  紐づけを解除する
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
            title={`${called}のログインアカウントの紐づけを解除しますか？`}
            description='解除すると、このアカウントは、次の操作からサロンの画面を使えなくなります。アカウントとスタッフ情報は残り、スタッフは、また招待できます。休職や退職の手続きの間は、解除せずに、スタッフ情報を無効にしてください。'
            actions={
              <>
                <Button onClick={close}>戻る</Button>
                <Button
                  variant='danger'
                  pending={unlink.isPending}
                  onClick={() => {
                    setMessage(undefined)
                    unlink.mutate()
                  }}
                >
                  解除する
                </Button>
              </>
            }
          >
            {message !== undefined && <Alert tone='danger'>{message}</Alert>}
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
  const [said, setSaid] = useState<string>()

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
      {said !== undefined && <Alert tone='warning'>{said}</Alert>}
      {match(shown)
        .with({ type: 'loading' }, () => (
          <LoadingIndicator label='ログインアカウントを読み込んでいます' />
        ))
        .with({ type: 'forbidden' }, () => <StaffLedgerForbidden />)
        .with({ type: 'unread' }, ({ reads }) => (
          <UnreadNotice
            message={unreadMessageOf('ログインアカウント', whyUnread(reads))}
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
        スタッフの内容へ
      </ButtonLink>
    </>
  )
}

/** The account a member of the staff ledger of the salon of the address signs in with, and the invitation that makes it. */
export const StaffAccountScreen = () => {
  const { salonId = '', staffId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => (
        <WithStaffMember
          key={staffId}
          salon={salon}
          title={TITLE}
          fresh={false}
        >
          {(member) => <LoginPart salon={salon} member={member} />}
        </WithStaffMember>
      )}
    </WithSalon>
  )
}
