import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type { ModelsCustomerPreferencesResponse } from '@beauty-salon-frontend/api-client'
import {
  afterPreferencesChange,
  PreferencesForm,
  readPreferencesChange,
  type StaffChoice,
} from '@beauty-salon-frontend/preferences'
import { RequireSession } from '@beauty-salon-frontend/session'
import {
  Alert,
  ButtonLink,
  EmptyState,
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
import { OWN_PROFILE, type ProfileRead } from '../profile/profile-api'
import { CUSTOMERS } from '../roles'
import { SignInHelp } from '../sign-in-help'
import {
  OWN_PREFERENCES,
  OWN_PREFERENCES_TO_CHANGE,
  type PreferencesRead,
  readOwnPreferencesToChange,
  updateOwnPreferences,
} from './preferences-api'

const TITLE = '好みの設定'

/** Where the preferences are shown, and where the form leads */
const MY_PAGE = '/mypage'

const UNREAD = P.union(...UNREAD_TYPES)

const BACK = (
  <ButtonLink href={MY_PAGE} variant='quiet'>
    マイページへ戻る
  </ButtonLink>
)

/** What the API says of an account that is no customer */
const NO_PREFERENCES: PreferencesRead = { type: 'none' }
const NO_PROFILE: ProfileRead = { type: 'none' }

type PreferencesChangeProps = {
  preferences: ModelsCustomerPreferencesResponse
  staff: readonly StaffChoice[]
  /** The profile was gone when the change was sent */
  onGone: () => void
}

/**
 * The form of the preferences. What it is sent with is compared with what
 * it opened with, and what differs is sent, nothing else: a preference the
 * customer did not touch stays what is stored, also when a salon changed it
 * while the form was open, and so does a member of the staff the form
 * could not show.
 */
const PreferencesChange = ({
  preferences,
  staff,
  onGone,
}: PreferencesChangeProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [says, setSays] = useState<FormSays>(NOTHING_TO_SAY)
  const update = useMutation({
    mutationFn: updateOwnPreferences,
    onSuccess: (outcome) => {
      if (outcome.type === 'updated') {
        // The page of the customer shows what was written at once. The
        // staff the form offered are those the page can name
        const read: PreferencesRead = {
          type: 'found',
          preferences: outcome.preferences,
          staff: [...staff],
        }
        queryClient.setQueryData(OWN_PREFERENCES, read)
        notify({ tone: 'success', message: '好みの設定を変更しました。' })
        void navigate(MY_PAGE)
        return
      }
      if (outcome.type === 'none') {
        queryClient.setQueryData(OWN_PREFERENCES_TO_CHANGE, NO_PREFERENCES)
        queryClient.setQueryData(OWN_PREFERENCES, NO_PREFERENCES)
        queryClient.setQueryData(OWN_PROFILE, NO_PROFILE)
        onGone()
        return
      }
      setSays(afterPreferencesChange(outcome))
    },
  })

  const submit = (values: FormData): void => {
    match(readPreferencesChange(values, preferences, staff))
      .with({ type: 'invalid' }, ({ errors }) =>
        setSays({ message: undefined, errors }),
      )
      // Nothing was changed, so there is nothing to ask the API for: the
      // customer is told so where the preferences are shown
      .with({ type: 'unchanged' }, () => {
        notify({ tone: 'info', message: '変更された項目はありません。' })
        void navigate(MY_PAGE)
      })
      .with({ type: 'valid' }, ({ value }) => update.mutate(value))
      .exhaustive()
  }

  return (
    <PreferencesForm
      preferences={preferences}
      staff={staff}
      submitLabel='変更を保存する'
      message={says.message}
      errors={says.errors}
      pending={update.isPending}
      actions={BACK}
      onSubmit={submit}
    />
  )
}

const OwnPreferencesToChange = () => {
  const read = useQuery({
    queryKey: OWN_PREFERENCES_TO_CHANGE,
    queryFn: readOwnPreferencesToChange,
    // A form opens with what is stored now and with the staff there are
    // now, and then nothing is read behind it: what somebody is filling in
    // is not taken away by an answer nobody asked for
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const focusHeading = useScreenHeadingFocus()
  /** The profile was gone when the customer sent a change */
  const [gone, setGone] = useState(false)

  // The form went with the button that sent it: the focus goes to the
  // heading of the screen, in the commit that shows what took its place
  useLayoutEffect(() => {
    if (gone) {
      focusHeading()
    }
  }, [gone, focusHeading])

  return (
    <>
      <PageHeader title={TITLE} />
      {/* What the form was opened with a while ago is not what it opens with */}
      {match(read.isFetchedAfterMount ? read.data : undefined)
        .with(undefined, () => (
          <LoadingIndicator label='好みの設定を読み込んでいます' />
        ))
        .with({ type: 'found' }, ({ preferences, staff }) => (
          <PreferencesChange
            preferences={preferences}
            staff={staff}
            onGone={() => setGone(true)}
          />
        ))
        .with({ type: 'none' }, () => (
          <>
            {gone && (
              <Alert tone='warning'>
                お客様の情報が見つからなかったため、変更を保存できませんでした。
              </Alert>
            )}
            <EmptyState
              title='好みの設定は、お客様の情報を登録すると使えます'
              description='お名前と電話番号を登録してから、もう一度お試しください。'
              actions={
                <ButtonLink href='/mypage/profile'>
                  お客様の情報を登録する
                </ButtonLink>
              }
            />
          </>
        ))
        .with({ type: UNREAD }, (reason) => (
          <UnreadNotice
            message={unreadMessageOf('好みの設定', reason)}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        ))
        .exhaustive()}
    </>
  )
}

/**
 * The form in which the customer who is signed in says what the salons
 * should keep in mind: whom they wish for and whom they avoid, when they
 * like to come, what they like of a style, and how they like to be served.
 */
export const PreferencesScreen = () => (
  <RequireSession
    roles={CUSTOMERS}
    signInNotice='好みの設定を変更するには、サインインしてください。'
    signInHelp={<SignInHelp />}
  >
    <OwnPreferencesToChange />
  </RequireSession>
)
