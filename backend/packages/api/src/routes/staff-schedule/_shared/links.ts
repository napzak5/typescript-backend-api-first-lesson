import { queryOf } from '../../../shared/page-links'

/**
 * Links of the schedule of a staff member. `schedulePath` is where the
 * routes are mounted, which names the salon and the staff member;
 * `requestUrl` is the request, whose query may ask for a single date.
 */
export const staffScheduleLinks = (
  schedulePath: string,
  requestUrl: string,
): { self: string; list: string } => {
  const query = new URLSearchParams(queryOf(requestUrl)).toString()

  return {
    self: query === '' ? schedulePath : `${schedulePath}?${query}`,
    list: schedulePath,
  }
}
