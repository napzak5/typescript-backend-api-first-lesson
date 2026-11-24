import {
  FilterForm,
  Select,
  useFilterValues,
  useSaidChoices,
  useSay,
} from '@beauty-salon-frontend/ui'
import { adminReviewReportMessages } from '@beauty-salon-shared/i18n/messages/admin'
import {
  REPORTS_SHOWN,
  type ReportsShown,
  SHOWN,
} from '../../utils/review-reports'

const { filter } = adminReviewReportMessages

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
  const say = useSay()
  const options = useSaidChoices()
  const [values, hold] = useFilterValues(shown, () => ({ [SHOWN]: shown }))

  return (
    <FilterForm label={say(filter.label)} purpose='view' onSubmit={onSubmit}>
      <Select
        label={say(filter.status)}
        name={SHOWN}
        options={options(REPORTS_SHOWN)}
        value={values[SHOWN]}
        onChange={(event) => hold(SHOWN, event.target.value)}
      />
    </FilterForm>
  )
}
