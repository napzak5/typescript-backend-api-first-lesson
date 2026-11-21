import { FilterForm, Select, useFilterValues } from '@beauty-salon-frontend/ui'
import { REPORTS_SHOWN, type ReportsShown, SHOWN } from '../../review-reports'

export type ReportFilterProps = {
  /** The reports that are shown: those of the address */
  shown: ReportsShown
  /** Called with the values of the control when the form is sent */
  onSubmit: (values: FormData) => void
}

/**
 * Which reports the list shows: those that wait for the platform, those
 * it dismissed, or all of them. Like the other filters, it mirrors the
 * address: the control shows what the address asks for whenever that
 * changes, and what was chosen until the form is sent.
 */
export const ReportFilter = ({ shown, onSubmit }: ReportFilterProps) => {
  const [values, hold] = useFilterValues(shown, () => ({ [SHOWN]: shown }))

  return (
    <FilterForm label='通報を絞り込む' purpose='view' onSubmit={onSubmit}>
      <Select
        label='状態'
        name={SHOWN}
        options={REPORTS_SHOWN}
        value={values[SHOWN]}
        onChange={(event) => hold(SHOWN, event.target.value)}
      />
    </FilterForm>
  )
}
