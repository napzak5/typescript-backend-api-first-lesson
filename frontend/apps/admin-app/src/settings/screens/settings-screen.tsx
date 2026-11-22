import { NOT_FOUND } from '@beauty-salon-frontend/answers'
import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  dayAt,
  readSalon,
  SALON_CHOICES,
  salonKeyOf,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import { OWN_SALON } from '@beauty-salon-frontend/session'
import {
  Alert,
  Button,
  ButtonLink,
  Dialog,
  LoadingIndicator,
  PageHeader,
  useNotifications,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match } from 'ts-pattern'
import {
  bookingsHrefOf,
  hoursChangeHrefOf,
  paymentMethodsHrefOf,
  salonChangeHrefOf,
} from '../../navigation'
import { removeSalon } from '../api/settings-api'
import { SalonRecord } from '../components/salon-record/salon-record'
import { SalonRemoval } from '../components/salon-removal/salon-removal'
import {
  afterSalonRemoval,
  type SalonRemovalRefusal,
} from '../utils/salon-removal'
import { useKeepsSalon, useRemovesSalon } from './keeps-salon'
import styles from './settings-screen.module.css'

const TITLE = 'サロンの設定'

type RemovalPartProps = { salon: ModelsSalonResponse }

/**
 * The removal of the salon, after a dialog has asked. A removed salon is
 * gone from the choice of a salon and from the account of its owner, and
 * the start of the application is shown with what was done.
 */
const RemovalPart = ({ salon }: RemovalPartProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [removing, setRemoving] = useState(false)
  /** What went wrong with an attempt that can be made again: said in the dialog */
  const [message, setMessage] = useState<string>()
  /** What another attempt does not change: said at the removal */
  const [refusal, setRefusal] = useState<SalonRemovalRefusal>()
  const key = salonKeyOf(salon.id)

  const forget = (): void => {
    queryClient.removeQueries({ queryKey: SALON_CHOICES })
    queryClient.removeQueries({ queryKey: OWN_SALON })
    queryClient.setQueryData(key, NOT_FOUND)
  }

  const removal = useMutation({
    mutationFn: () => removeSalon(salon.id),
    onSuccess: (outcome) =>
      match(afterSalonRemoval(outcome, salon.name))
        .with({ type: 'done' }, ({ message: done }) => {
          forget()
          notify({ tone: 'success', message: done })
          void navigate('/')
        })
        .with({ type: 'again' }, ({ message: again }) => setMessage(again))
        .with({ type: 'refused' }, ({ refusal: refused }) => {
          setRemoving(false)
          setRefusal(refused)
        })
        .with({ type: 'gone' }, () => {
          setRemoving(false)
          forget()
        })
        .exhaustive(),
  })

  const close = (): void => {
    setRemoving(false)
    setMessage(undefined)
  }

  return (
    <>
      <SalonRemoval
        name={salon.name}
        refusal={refusal}
        bookingsHref={bookingsHrefOf(salon.id)}
        onRemove={() => {
          setRefusal(undefined)
          setRemoving(true)
        }}
      />
      <Dialog
        open={removing}
        onClose={close}
        title={`サロン「${salon.name}」を削除しますか？`}
        description='削除したサロンは、元に戻せません。サロンの一覧とお客様の画面から消え、スタッフはこのサロンの画面を使えなくなります。'
        actions={
          <>
            <Button onClick={close}>戻る</Button>
            <Button
              variant='danger'
              pending={removal.isPending}
              onClick={() => {
                setMessage(undefined)
                removal.mutate()
              }}
            >
              削除する
            </Button>
          </>
        }
      >
        {message !== undefined && <Alert tone='danger'>{message}</Alert>}
      </Dialog>
    </>
  )
}

type SettingsPartProps = { salon: ModelsSalonResponse }

/**
 * The settings of the salon, read anew whenever the screen opens: the
 * salon that was read before may have been changed since. An account that
 * changes the settings is offered to change the information of the salon
 * and its hours, and the owner and an administrator to remove it.
 */
const SettingsPart = ({ salon }: SettingsPartProps) => {
  const keeps = useKeepsSalon()
  const removes = useRemovesSalon()
  const read = useQuery({
    queryKey: salonKeyOf(salon.id),
    queryFn: () => readSalon(salon.id),
    staleTime: 0,
  })

  return (
    <>
      <PageHeader
        title={TITLE}
        description={salon.name}
        actions={
          keeps ? (
            <>
              <ButtonLink href={salonChangeHrefOf(salon.id)} variant='primary'>
                サロンの情報を直す
              </ButtonLink>
              <ButtonLink href={hoursChangeHrefOf(salon.id)}>
                営業時間を直す
              </ButtonLink>
            </>
          ) : undefined
        }
      />
      {read.isFetchedAfterMount ? (
        <div className={styles['settings']}>
          <SalonRecord
            salon={salon}
            today={dayAt(new Date(), salon.timezone)}
            paymentMethodsHref={paymentMethodsHrefOf(salon.id)}
          />
          {removes && <RemovalPart salon={salon} />}
        </div>
      ) : (
        <LoadingIndicator label='サロンの設定を読み込んでいます' />
      )}
    </>
  )
}

/** The settings of the salon of the address, for everybody who works at it. */
export const SettingsScreen = () => {
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => <SettingsPart key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
