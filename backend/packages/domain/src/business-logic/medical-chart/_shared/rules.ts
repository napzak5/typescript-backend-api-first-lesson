import type { ValidationIssue } from '../../../shared'
import { latestDateOf } from '../../customer/_shared/rules'

/**
 * What a chart must satisfy beyond the shape of a request: the rule that
 * needs the current time. A previous treatment took place, so its date is
 * not after today, judged as a birth date is (`latestDateOf`). The dates
 * are in ISO 8601, which sorts as text.
 */
export const medicalChartRuleIssues = (
  chart: { previousTreatments?: { date: string }[] },
  now: Date,
): ValidationIssue[] => {
  const latest = latestDateOf(now)
  return (chart.previousTreatments ?? []).flatMap(({ date }, index) =>
    date > latest
      ? [
          {
            field: `previousTreatments.${index}.date`,
            rule: 'too_big',
            message: 'Must not be in the future',
          },
        ]
      : [],
  )
}
