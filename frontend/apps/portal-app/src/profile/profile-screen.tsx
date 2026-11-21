import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type { ModelsCustomerProfileResponse } from '@beauty-salon-frontend/api-client'
import { RequireSession } from '@beauty-salon-frontend/session'
import {
  Alert,
  ButtonLink,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
  useNotifications,
  useScreenHeadingFocus,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLayoutEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { match, P } from 'ts-pattern'
import { type FormSays, NOTHING_TO_SAY } from '../forms'
import { CUSTOMERS } from '../roles'
import { SignInHelp } from '../sign-in-help'
import { ProfileForm } from './components/profile-form/profile-form'
import {
  createOwnProfile,
  OWN_PROFILE,
  type ProfileRead,
  readOwnProfile,
  updateOwnProfile,
} from './profile-api'
import {
  afterProfileChange,
  afterWholeProfile,
  readProfileChange,
  readWholeProfile,
} from './profile-flow'
import { localDateOf } from './profile-format'

/**
 * The heading of the screen, whichever of its two forms it shows: which
 * one that is, is known when the profile is read, and a screen that
 * changed its name then would be taken for another screen.
 */
const TITLE = 'お客様の情報'

/** Where the profile is shown, and where both forms lead */
const MY_PAGE = '/mypage'

const UNREAD = P.union(...UNREAD_TYPES)

const BACK = (
  <ButtonLink href={MY_PAGE} variant='quiet'>
    マイページへ戻る
  </ButtonLink>
)

type ProfileChangeProps = {
  profile: ModelsCustomerProfileResponse
  /** The profile was gone when the change was sent */
  onGone: () => void
}

/**
 * The form of the profile there is. What it is sent with is compared with
 * the profile it opened with, and what differs is sent, nothing else: a
 * value the customer did not touch stays what the salons have, also when a
 * salon changed it while the form was open.
 */
const ProfileChange = ({ profile, onGone }: ProfileChangeProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [says, setSays] = useState<FormSays>(NOTHING_TO_SAY)
  const today = localDateOf(new Date())
  const update = useMutation({
    mutationFn: updateOwnProfile,
    onSuccess: (outcome) => {
      if (outcome.type === 'updated') {
        const read: ProfileRead = { type: 'found', profile: outcome.profile }
        queryClient.setQueryData(OWN_PROFILE, read)
        notify({ tone: 'success', message: 'お客様の情報を変更しました。' })
        void navigate(MY_PAGE)
        return
      }
      if (outcome.type === 'none') {
        const read: ProfileRead = { type: 'none' }
        queryClient.setQueryData(OWN_PROFILE, read)
        onGone()
        return
      }
      setSays(afterProfileChange(outcome))
    },
  })

  const submit = (values: FormData): void => {
    match(readProfileChange(values, profile, today))
      .with({ type: 'invalid' }, ({ errors }) =>
        setSays({ message: undefined, errors }),
      )
      // Nothing was changed, so there is nothing to ask the API for: the
      // customer is told so where the profile is shown
      .with({ type: 'unchanged' }, () => {
        notify({ tone: 'info', message: '変更された項目はありません。' })
        void navigate(MY_PAGE)
      })
      .with({ type: 'valid' }, ({ value }) => update.mutate(value))
      .exhaustive()
  }

  return (
    <ProfileForm
      profile={profile}
      today={today}
      submitLabel='変更を保存する'
      message={says.message}
      errors={says.errors}
      pending={update.isPending}
      actions={BACK}
      onSubmit={submit}
    />
  )
}

/** The form of an account that has no profile: what it is sent with makes one. */
const ProfileRegistration = () => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [says, setSays] = useState<FormSays>(NOTHING_TO_SAY)
  const today = localDateOf(new Date())
  const creation = useMutation({
    mutationFn: createOwnProfile,
    onSuccess: (outcome) => {
      if (outcome.type === 'created') {
        const read: ProfileRead = { type: 'found', profile: outcome.profile }
        queryClient.setQueryData(OWN_PROFILE, read)
        notify({ tone: 'success', message: 'お客様の情報を登録しました。' })
        void navigate(MY_PAGE)
        return
      }
      setSays(afterWholeProfile(outcome))
    },
  })

  const submit = (values: FormData): void => {
    const read = readWholeProfile(values, today)
    if (read.type === 'invalid') {
      setSays({ message: undefined, errors: read.errors })
      return
    }
    creation.mutate(read.value)
  }

  return (
    <ProfileForm
      profile={null}
      today={today}
      submitLabel='登録する'
      message={says.message}
      errors={says.errors}
      pending={creation.isPending}
      actions={BACK}
      onSubmit={submit}
    />
  )
}

const OwnProfile = () => {
  const read = useQuery({
    queryKey: OWN_PROFILE,
    queryFn: readOwnProfile,
    // A form opens with what the salons have now, and then nothing is read
    // behind it: what somebody is filling in is not taken away by an answer
    // nobody asked for
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const focusHeading = useScreenHeadingFocus()
  /** The profile was gone when the customer sent a change of it */
  const [gone, setGone] = useState(false)

  // The form of the change went with the button that sent it, and the form
  // of a new profile took its place: the focus goes to the heading of the
  // screen, in the commit that shows it
  useLayoutEffect(() => {
    if (gone) {
      focusHeading()
    }
  }, [gone, focusHeading])

  // What another screen read a while ago is not what a form opens with
  return match(read.isFetchedAfterMount ? read.data : undefined)
    .with(undefined, () => (
      <>
        <PageHeader title={TITLE} />
        <LoadingIndicator label='お客様の情報を読み込んでいます' />
      </>
    ))
    .with({ type: 'found' }, ({ profile }) => (
      <>
        <PageHeader title={TITLE} />
        <ProfileChange profile={profile} onGone={() => setGone(true)} />
      </>
    ))
    .with({ type: 'none' }, () => (
      <>
        <PageHeader
          title={TITLE}
          description='お名前と電話番号は、サロンを予約するために必要です。そのほかの項目は、あとからでも登録できます。'
        />
        {gone && (
          <Alert tone='warning'>
            お客様の情報が見つからなかったため、変更を保存できませんでした。お手数ですが、もう一度登録してください。
          </Alert>
        )}
        <ProfileRegistration />
      </>
    ))
    .with({ type: UNREAD }, (reason) => (
      <>
        <PageHeader title={TITLE} />
        <UnreadNotice
          message={unreadMessageOf('お客様の情報', reason)}
          onRetry={() => void read.refetch()}
          pending={read.isFetching}
        />
      </>
    ))
    .exhaustive()
}

/**
 * The form in which the customer who is signed in says who they are: for
 * an account that has a profile it changes it, for one that has none it
 * makes it.
 */
export const ProfileScreen = () => (
  <RequireSession
    roles={CUSTOMERS}
    signInNotice='お客様の情報を登録、変更するには、サインインしてください。'
    signInHelp={<SignInHelp />}
  >
    <OwnProfile />
  </RequireSession>
)
