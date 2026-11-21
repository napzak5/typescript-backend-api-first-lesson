import {
  countNarrowing,
  FilterForm,
  Select,
  useFilterValues,
} from '@beauty-salon-frontend/ui'
import { ALERT_KIND_OPTIONS, SEVERITY_OPTIONS } from '../../alert-format'
import {
  ACKNOWLEDGED_OPTIONS,
  type AlertConditions,
  alertQueryOf,
} from '../../alert-search'

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
  const [values, hold] = useFilterValues(
    alertQueryOf(conditions).toString(),
    () => valuesOf(conditions),
  )

  return (
    <FilterForm
      label='在庫のアラートを絞り込む'
      purpose='view'
      clearHref={clearHref}
      onSubmit={onSubmit}
      conditionCount={countNarrowing(valuesOf(conditions), COUNTED)}
      conditions={
        <>
          <Select
            label='種類'
            name='alert'
            options={ALERT_KIND_OPTIONS}
            placeholder='すべて'
            value={values.alert}
            onChange={(event) => hold('alert', event.target.value)}
          />
          <Select
            label='重要度'
            name='severity'
            options={SEVERITY_OPTIONS}
            placeholder='すべて'
            value={values.severity}
            onChange={(event) => hold('severity', event.target.value)}
          />
          <Select
            label='確認'
            name='acknowledged'
            options={ACKNOWLEDGED_OPTIONS}
            placeholder='すべて'
            value={values.acknowledged}
            onChange={(event) => hold('acknowledged', event.target.value)}
          />
        </>
      }
    />
  )
}
