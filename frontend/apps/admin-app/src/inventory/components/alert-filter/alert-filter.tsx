import {
  countNarrowing,
  FilterForm,
  Select,
  useFilterValues,
  useSaidChoices,
  useSay,
} from '@beauty-salon-frontend/ui'
import { adminInventoryMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { ALERT_KIND_CHOICES, SEVERITY_CHOICES } from '../../utils/alert-format'
import {
  ACKNOWLEDGED_CHOICES,
  type AlertConditions,
  alertQueryOf,
} from '../../utils/alert-search'

const { filter: words } = adminInventoryMessages.alerts

export type AlertFilterProps = {
  /** The conditions that are shown: those of the address */
  conditions: AlertConditions
  /** The address of every alert, when the conditions narrow them */
  clearHref?: string | undefined
  /** Called with the values of the controls when the form is sent */
  onSubmit: (values: FormData) => void
}

/** What the controls hold, under the names of the conditions */
type Values = Record<'alert' | 'severity' | 'acknowledged', string>

const valuesOf = ({
  alert,
  severity,
  acknowledged,
}: AlertConditions): Values => ({
  alert: alert ?? '',
  severity: severity ?? '',
  acknowledged: acknowledged === undefined ? '' : `${acknowledged}`,
})

/** The conditions of the sheet that narrow the list: its button counts them */
const COUNTED: readonly (keyof Values)[] = ['alert', 'severity', 'acknowledged']

/**
 * Which alerts of the stock the screen shows: their kind, their severity,
 * and whether somebody saw to them. Like the filter of the movements, it
 * mirrors the address.
 */
export const AlertFilter = ({
  conditions,
  clearHref,
  onSubmit,
}: AlertFilterProps) => {
  const say = useSay()
  const options = useSaidChoices()
  const [values, hold] = useFilterValues(
    alertQueryOf(conditions).toString(),
    () => valuesOf(conditions),
  )

  return (
    <FilterForm
      label={say(words.label)}
      purpose='view'
      clearHref={clearHref}
      onSubmit={onSubmit}
      conditionCount={countNarrowing(valuesOf(conditions), COUNTED)}
      conditions={
        <>
          <Select
            label={say(words.kind)}
            name='alert'
            options={options(ALERT_KIND_CHOICES)}
            placeholder={say(words.all)}
            value={values.alert}
            onChange={(event) => hold('alert', event.target.value)}
          />
          <Select
            label={say(words.severity)}
            name='severity'
            options={options(SEVERITY_CHOICES)}
            placeholder={say(words.all)}
            value={values.severity}
            onChange={(event) => hold('severity', event.target.value)}
          />
          <Select
            label={say(words.acknowledgement)}
            name='acknowledged'
            options={options(ACKNOWLEDGED_CHOICES)}
            placeholder={say(words.all)}
            value={values.acknowledged}
            onChange={(event) => hold('acknowledged', event.target.value)}
          />
        </>
      }
    />
  )
}
