import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  ButtonLink,
  LoadingIndicator,
  PageHeader,
} from '@beauty-salon-frontend/ui'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { salonChangeHrefOf } from '../navigation'
import { dayAt } from '../salon-time'
import { readSalon, salonKeyOf } from '../salons/salons-api'
import { WithSalon } from '../salons/with-salon'
import { SalonRecord } from './components/salon-record/salon-record'
import { useKeepsSalon } from './keeps-salon'

const TITLE = 'サロンの設定'

type SettingsPartProps = { salon: ModelsSalonResponse }

/**
 * The settings of the salon, read anew whenever the screen opens: the
 * salon that was read before may have been changed since. An account that
 * changes the settings is offered to change the information of the salon.
 */
const SettingsPart = ({ salon }: SettingsPartProps) => {
  const keeps = useKeepsSalon()
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
            <ButtonLink href={salonChangeHrefOf(salon.id)} variant='primary'>
              サロンの情報を直す
            </ButtonLink>
          ) : undefined
        }
      />
      {read.isFetchedAfterMount ? (
        <SalonRecord salon={salon} today={dayAt(new Date(), salon.timezone)} />
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
