import { unreadMessageOf } from '@beauty-salon-frontend/answers'
import type {
  ModelsSalonResponse,
  ModelsServiceResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import { RequireSession } from '@beauty-salon-frontend/session'
import {
  Alert,
  ButtonLink,
  Card,
  Checkbox,
  DescriptionList,
  Form,
  LoadingIndicator,
  PageHeader,
  TextArea,
  TextField,
  UnreadNotice,
  useNotifications,
  useScreenHeadingFocus,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { type FormSays, NOTHING_TO_SAY } from '../forms'
import {
  createOwnProfile,
  OWN_PROFILE,
  type ProfileRead,
  readOwnProfile,
} from '../profile/profile-api'
import { afterProfile, readProfile } from '../profile/profile-flow'
import { CUSTOMERS } from '../roles'
import { dateAt, durationOf } from '../salons/salon-format'
import { readSalon, readStaff } from '../salons/salons-api'
import { SignInHelp } from '../sign-in-help'
import {
  type Choice,
  choiceIn,
  isBookable,
  queryOf,
  staffFor,
  timesOf,
} from './booking-choice'
import { afterBooking, readBooking } from './booking-flow'
import { priceLineOf } from './booking-format'
import { book, readService, readSlots } from './bookings-api'
import {
  BookingForm,
  type TimesOfDay,
} from './components/booking-form/booking-form'
import { OWN_BOOKING_LISTS } from './own-bookings'

const TITLE = '予約する'

const UNREAD = P.union('tooManyRequests', 'failed')

type OfServiceProps = {
  salon: ModelsSalonResponse
  service: ModelsServiceResponse
}

/**
 * Who the customer is. An account that has just been registered has not
 * said so, and the API books for a customer: the screen asks for what a
 * salon needs to know of somebody who comes, and no more.
 */
const ProfileStep = () => {
  const queryClient = useQueryClient()
  const [says, setSays] = useState<FormSays>(NOTHING_TO_SAY)
  const creation = useMutation({
    mutationFn: createOwnProfile,
    onSuccess: (outcome) => {
      if (outcome.type === 'created') {
        const read: ProfileRead = { type: 'found', profile: outcome.profile }
        queryClient.setQueryData(OWN_PROFILE, read)
        return
      }
      setSays(afterProfile(outcome))
    },
  })

  const submit = (values: FormData): void => {
    const read = readProfile(values)
    if (read.type === 'invalid') {
      setSays({ message: undefined, errors: read.errors })
      return
    }
    creation.mutate(read.value)
  }

  return (
    <Card title='お客様の情報'>
      <p>
        はじめてのご予約です。サロンがお客様をお迎えするために、お名前と電話番号を登録してください。
      </p>
      <Form
        submitLabel='登録して、日時の選択へ進む'
        message={says.message}
        errors={says.errors}
        pending={creation.isPending}
        onSubmit={submit}
      >
        <TextField
          label='姓'
          name='lastName'
          autoComplete='family-name'
          required
          error={says.errors['lastName']}
        />
        <TextField
          label='名'
          name='firstName'
          autoComplete='given-name'
          required
          error={says.errors['firstName']}
        />
        <TextField
          label='電話番号'
          name='phoneNumber'
          type='tel'
          autoComplete='tel'
          required
          description='ご予約について、サロンから連絡することがあります。'
          error={says.errors['phoneNumber']}
        />
        <Checkbox label='メールでの連絡を受け取る' name='allowEmail' />
        <Checkbox label='SMS での連絡を受け取る' name='allowSms' />
        <Checkbox
          label='キャンペーンなどのお知らせを受け取る'
          name='allowMarketing'
        />
      </Form>
    </Card>
  )
}

type TimeStepProps = OfServiceProps & {
  staff: readonly ModelsStaffProfileResponse[]
}

/**
 * With whom, on which day and at which time. The staff and the day are in
 * the address, so a reload shows the times of the same day; they are
 * replaced there, so the way back leads out of the screen and not through
 * every day that was looked at.
 */
const TimeStep = ({ salon, service, staff }: TimeStepProps) => {
  const [query, setQuery] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { notify } = useNotifications()
  const [says, setSays] = useState<FormSays>(NOTHING_TO_SAY)
  const today = dateAt(new Date(), salon.timezone)
  const choice = choiceIn(query, today, staff)
  const slots = useQuery({
    queryKey: ['salons', salon.id, 'slots', service.id, queryOf(choice)],
    queryFn: () =>
      readSlots({
        salonId: salon.id,
        serviceId: service.id,
        ...choice,
        duration: undefined,
      }),
    // A time is free until somebody books it: the times of a day are read
    // whenever they are shown, and never shown from memory
    staleTime: 0,
    gcTime: 0,
  })
  const times =
    slots.data?.type === 'found'
      ? timesOf(slots.data.slots, salon.timezone)
      : []
  const booking = useMutation({
    mutationFn: book,
    onSuccess: (outcome) => {
      if (outcome.type === 'booked') {
        queryClient.setQueryData(['own', 'bookings', outcome.booking.id], {
          type: 'found',
          booking: outcome.booking,
        })
        queryClient.removeQueries({ queryKey: OWN_BOOKING_LISTS })
        notify({
          tone: 'success',
          message: '予約を受け付けました。',
        })
        void navigate(`/bookings/${outcome.booking.id}`)
        return
      }
      setSays(afterBooking(outcome))
      if (outcome.type === 'refused') {
        void slots.refetch()
      }
      if (outcome.type === 'noProfile') {
        void queryClient.invalidateQueries({ queryKey: OWN_PROFILE })
      }
    },
  })

  const choose = (next: Choice): void => {
    // What was said about a time of another day is said no longer
    setSays(NOTHING_TO_SAY)
    setQuery(queryOf(next), { replace: true })
  }

  const submit = (values: FormData): void => {
    const read = readBooking(values, {
      salonId: salon.id,
      serviceId: service.id,
      staffId: choice.staffId,
      times,
    })
    if (read.type === 'invalid') {
      setSays({ message: undefined, errors: read.errors })
      return
    }
    booking.mutate(read.value)
  }

  return (
    <Card title='日時'>
      <BookingForm
        staff={staff}
        choice={choice}
        today={today}
        onChoose={choose}
        times={match(slots.data)
          .returnType<TimesOfDay>()
          .with(undefined, () => ({ type: 'loading' }))
          .with({ type: 'found' }, () => ({ type: 'listed', times }))
          .with({ type: UNREAD }, (reason) => ({
            type: 'unread',
            reason,
            retrying: slots.isFetching,
          }))
          .exhaustive()}
        onRetry={() => void slots.refetch()}
        submitLabel='この内容で予約する'
        message={says.message}
        errors={says.errors}
        pending={booking.isPending}
        onSubmit={submit}
      >
        <TextArea
          label='ご要望'
          name='customerRequest'
          rows={4}
          description='サロンに伝えておきたいことがあれば、ご記入ください。'
          error={says.errors['customerRequest']}
        />
      </BookingForm>
    </Card>
  )
}

/** What is booked, and below it the step the customer is at. */
const BookingSteps = ({ salon, service }: OfServiceProps) => {
  const staff = useQuery({
    queryKey: ['salons', salon.id, 'staff'],
    queryFn: () => readStaff(salon.id),
  })
  const profile = useQuery({
    queryKey: OWN_PROFILE,
    queryFn: readOwnProfile,
  })
  const focusHeading = useScreenHeadingFocus()
  const step = profile.data?.type
  const stepBefore = useRef(step)

  // The form of the profile went with the button that sent it, and the
  // times took its place: the focus goes to the heading of the screen, in
  // the commit that shows them
  useLayoutEffect(() => {
    if (stepBefore.current === 'none' && step === 'found') {
      focusHeading()
    }
    stepBefore.current = step
  }, [step, focusHeading])

  return (
    <>
      <Card title='ご予約の内容'>
        <DescriptionList
          items={[
            { term: 'サロン', description: salon.name },
            { term: 'メニュー', description: service.name },
            { term: '所要時間', description: durationOf(service.duration) },
            {
              term: '料金',
              description: priceLineOf(service, salon.currency),
            },
          ]}
        />
      </Card>
      {match([staff.data, profile.data])
        .with([undefined, P._], [P._, undefined], () => (
          <LoadingIndicator label='予約に必要な情報を読み込んでいます' />
        ))
        .with([{ type: UNREAD }, P._], ([reason]) => (
          <UnreadNotice
            message={unreadMessageOf('スタッフ', reason)}
            onRetry={() => void staff.refetch()}
            pending={staff.isFetching}
          />
        ))
        .with([P._, { type: UNREAD }], ([, reason]) => (
          <UnreadNotice
            message={unreadMessageOf('お客様の情報', reason)}
            onRetry={() => void profile.refetch()}
            pending={profile.isFetching}
          />
        ))
        .with([{ type: 'found' }, { type: 'none' }], () => <ProfileStep />)
        .with([{ type: 'found' }, { type: 'found' }], ([found]) => (
          <TimeStep
            salon={salon}
            service={service}
            staff={staffFor(service, found.staff)}
          />
        ))
        .exhaustive()}
    </>
  )
}

const BookingPage = () => {
  const { salonId = '', serviceId = '' } = useParams()
  const salon = useQuery({
    queryKey: ['salons', salonId, 'salon'],
    queryFn: () => readSalon(salonId),
  })
  const service = useQuery({
    queryKey: ['salons', salonId, 'services', serviceId],
    queryFn: () => readService(salonId, serviceId),
  })

  return match([salon.data, service.data])
    .with([undefined, P._], [P._, undefined], () => (
      <>
        <PageHeader title={TITLE} />
        <LoadingIndicator label='メニューを読み込んでいます' />
      </>
    ))
    .with([{ type: 'notFound' }, P._], [P._, { type: 'notFound' }], () => (
      <>
        <PageHeader
          title='予約できるメニューが見つかりません'
          description='アドレスが正しいか、お確かめください。掲載を終えたサロンか、メニューかもしれません。'
        />
        <ButtonLink href='/'>サロンを探す</ButtonLink>
      </>
    ))
    .with([{ type: UNREAD }, P._], ([reason]) => (
      <>
        <PageHeader title={TITLE} />
        <UnreadNotice
          message={unreadMessageOf('サロン', reason)}
          onRetry={() => void salon.refetch()}
          pending={salon.isFetching}
        />
      </>
    ))
    .with([P._, { type: UNREAD }], ([, reason]) => (
      <>
        <PageHeader title={TITLE} />
        <UnreadNotice
          message={unreadMessageOf('メニュー', reason)}
          onRetry={() => void service.refetch()}
          pending={service.isFetching}
        />
      </>
    ))
    .with([{ type: 'found' }, { type: 'found' }], ([foundSalon, found]) => (
      <>
        <PageHeader
          title={TITLE}
          actions={
            <ButtonLink href={`/salons/${foundSalon.salon.id}`}>
              サロンのページへ戻る
            </ButtonLink>
          }
        />
        {isBookable(foundSalon.salon, found.service) ? (
          <BookingSteps salon={foundSalon.salon} service={found.service} />
        ) : (
          <Alert tone='warning'>
            「{found.service.name}
            」は、この画面からは予約できません。ご予約は、サロンへお問い合わせください。
          </Alert>
        )}
      </>
    ))
    .exhaustive()
}

/**
 * Where a customer books a service of a salon. Somebody who is not signed
 * in signs in here, at the address of what they chose, and goes on with it.
 */
export const BookingScreen = () => (
  <RequireSession
    roles={CUSTOMERS}
    signInNotice='予約するには、サインインしてください。'
    signInHelp={<SignInHelp />}
  >
    <BookingPage />
  </RequireSession>
)
