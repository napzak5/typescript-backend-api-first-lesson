import { text } from '../../languages/localized-text'

/** What the API says of the schedules of the staff. */
export const staffScheduleMessages = {
  invalidStaffScheduleSearch: text({
    en: 'Invalid staff schedule search',
    ja: 'スタッフの勤務の検索の条件が正しくありません',
  }),
  invalidStaffScheduleUpdate: text({
    en: 'Invalid staff schedule update',
    ja: 'スタッフの勤務の変更の内容が正しくありません',
  }),
  requiredForWeeklyEntry: text({
    en: 'Required for a weekly entry',
    ja: '毎週の勤務では、指定してください',
  }),
  nullForWeeklyEntry: text({
    en: 'Must be null for a weekly entry',
    ja: '毎週の勤務では、null にしてください',
  }),
  requiredForSingleDay: text({
    en: 'Required for an entry of a single day',
    ja: '1 日だけの勤務では、指定してください',
  }),
  nullForSingleDay: text({
    en: 'Must be null for an entry of a single day',
    ja: '1 日だけの勤務では、null にしてください',
  }),
  nullForDayOff: text({
    en: 'Must be null for a day off',
    ja: '休みの日は、null にしてください',
  }),
  requiredForWorkingDay: text({
    en: 'Required for a working day',
    ja: '勤務する日は、指定してください',
  }),
  /** `other` is a property of the request. */
  requiredWhenGiven: (other: string) =>
    text({
      en: `Required when ${other} is given`,
      ja: `${other} を指定するときは、指定してください`,
    }),
  /** `later` is a property of the request. */
  earlierThan: (later: string) =>
    text({
      en: `Must be earlier than ${later}`,
      ja: `${later} より前にしてください`,
    }),
  noRepeatedDayOfWeek: text({
    en: 'Must not repeat the day of the week of an earlier entry',
    ja: '前の要素と同じ曜日は指定できません',
  }),
  noRepeatedDate: text({
    en: 'Must not repeat the date of an earlier entry',
    ja: '前の要素と同じ日付は指定できません',
  }),
}
