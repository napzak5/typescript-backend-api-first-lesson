import type { ModelsStaffSchedule } from '@beauty-salon-frontend/api-client'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import {
  aPastDayOff,
  aSchedule,
  aShortSaturday,
  aSundayOff,
  aTrainingDay,
  aWeek,
  TODAY,
} from '../components/examples'
import {
  afterScheduleSave,
  partsOf,
  readScheduleChange,
  type ScheduleRequest,
  timeInputOf,
} from './schedule-form'

/** What the form says at its controls */
const START_MISSING: LocalizedText = {
  en: 'Enter the time the work starts.',
  ja: '勤務の始まりの時刻を入力してください。',
}
const REFUSED_VALUE: LocalizedText = {
  en: 'This value was not accepted. Check what you entered.',
  ja: 'この値は受け付けられませんでした。入力を確かめてください。',
}

/** The controls of the form opened with the schedule of the examples, as the browser hands them over */
const OPENED: [string, string][] = [
  ...['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].flatMap(
    (weekday): [string, string][] => [
      [`${weekday}.works`, 'works'],
      [`${weekday}.startTime`, '09:00'],
      [`${weekday}.endTime`, '20:00'],
      [`${weekday}.breakStartTime`, '13:00'],
      [`${weekday}.breakEndTime`, '14:00'],
      [`${weekday}.notes`, ''],
    ],
  ),
  ['saturday.works', 'works'],
  ['saturday.startTime', '10:00'],
  ['saturday.endTime', '18:00'],
  ['saturday.breakStartTime', ''],
  ['saturday.breakEndTime', ''],
  ['saturday.notes', ''],
  ['sunday.works', 'off'],
  ['sunday.notes', '定休日'],
  ['dates.0.date', '2026-11-21'],
  ['dates.0.works', 'works'],
  ['dates.0.startTime', '12:00'],
  ['dates.0.endTime', '18:00'],
  ['dates.0.breakStartTime', ''],
  ['dates.0.breakEndTime', ''],
  ['dates.0.notes', '午前は講習'],
]

/** The form as it was opened, with some values changed, without some controls and with others after them */
const formWith = (
  changed: Record<string, string>,
  added: [string, string][] = [],
  removed: readonly string[] = [],
): FormData => {
  const values = new FormData()
  for (const [name, value] of [...OPENED, ...added]) {
    if (!removed.includes(name)) {
      values.append(name, changed[name] ?? value)
    }
  }

  return values
}

/** A row of a date the form adds: a day off */
const dayOff = (index: number, date: string): [string, string][] => [
  [`dates.${index}.date`, date],
  [`dates.${index}.works`, 'off'],
  [`dates.${index}.notes`, ''],
]

const WEEKLY_CONTROLS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

describe('partsOf', () => {
  it('should show the weekly rows by their days and the rows of dates from today, and keep those before it apart', () => {
    // Act
    const parts = partsOf(aSchedule(), TODAY)

    // Assert
    expect(parts.weekly.map(({ weekday, row }) => [weekday, row])).toEqual([
      ...aWeek().map((row) => [row.dayOfWeek, row]),
      ['sunday', aSundayOff()],
    ])
    expect(parts.dates).toEqual([aShortSaturday()])
    expect(parts.past).toEqual([aPastDayOff(), aTrainingDay()])
  })

  it('should show a row of today among the rows from today', () => {
    expect(partsOf([aShortSaturday()], '2026-11-21').dates).toEqual([
      aShortSaturday(),
    ])
  })

  it('should leave a day of the week without a row empty', () => {
    expect(partsOf([], TODAY).weekly.map(({ row }) => row)).toEqual(
      Array.from({ length: 7 }, () => undefined),
    )
  })
})

describe('timeInputOf', () => {
  it.each<[string | null, string | undefined]>([
    ['09:00:00', '09:00'],
    ['09:00:30', '09:00:30'],
    [null, undefined],
  ])('should hold %s as %s', (time, input) => {
    expect(timeInputOf(time)).toBe(input)
  })
})

describe('readScheduleChange', () => {
  it('should ask for nothing when the form is sent as it was opened', () => {
    expect(readScheduleChange(formWith({}), aSchedule(), TODAY)).toEqual({
      type: 'unchanged',
    })
  })

  it('should ask for nothing when a weekly day off without a note is sent as no row', () => {
    // Arrange
    const quiet: ModelsStaffSchedule = { ...aSundayOff(), notes: null }

    // Act
    const change = readScheduleChange(
      formWith({ 'sunday.notes': '' }),
      [...aWeek(), quiet, aShortSaturday()],
      TODAY,
    )

    // Assert
    expect(change).toEqual({ type: 'unchanged' })
  })

  it('should send the whole schedule: the week, then the rows of dates by their dates, those before today among them', () => {
    // Act
    const change = readScheduleChange(
      formWith({ 'monday.startTime': '10:00' }, dayOff(1, '2026-11-10')),
      aSchedule(),
      TODAY,
    )

    // Assert
    const [monday, ...days] = aWeek()
    const request: ScheduleRequest = {
      rows: [
        ...(monday === undefined ? [] : [{ ...monday, startTime: '10:00:00' }]),
        ...days,
        aSundayOff(),
        aPastDayOff(),
        {
          dayOfWeek: null,
          date: '2026-11-10',
          startTime: null,
          endTime: null,
          breakStartTime: null,
          breakEndTime: null,
          isRecurring: false,
          isAvailable: false,
          notes: null,
        },
        aTrainingDay(),
        aShortSaturday(),
      ],
      controls: [
        ...WEEKLY_CONTROLS,
        undefined,
        'dates.1',
        undefined,
        'dates.0',
      ],
    }
    expect(change).toEqual({ type: 'valid', value: request })
  })

  it('should leave out a day of the week the member does not work on and that has no note', () => {
    // Act
    const change = readScheduleChange(
      formWith({ 'sunday.notes': ' ' }),
      aSchedule(),
      TODAY,
    )

    // Assert
    expect(change.type === 'valid' && change.value.controls).toEqual([
      ...WEEKLY_CONTROLS.slice(0, 6),
      undefined,
      undefined,
      'dates.0',
    ])
  })

  it('should keep the note of a day off, and send no hours for it', () => {
    // Act
    const change = readScheduleChange(
      formWith(
        { 'monday.works': 'off', 'monday.notes': '  休業日 ' },
        [],
        [
          'monday.startTime',
          'monday.endTime',
          'monday.breakStartTime',
          'monday.breakEndTime',
        ],
      ),
      aSchedule(),
      TODAY,
    )

    // Assert
    expect(change.type === 'valid' && change.value.rows[0]).toEqual({
      dayOfWeek: 'monday',
      date: null,
      startTime: null,
      endTime: null,
      breakStartTime: null,
      breakEndTime: null,
      isRecurring: true,
      isAvailable: false,
      notes: '休業日',
    })
  })

  it('should drop the rows of the days before today when told to', () => {
    // Act
    const change = readScheduleChange(
      formWith({}, [['dropPast', 'on']]),
      aSchedule(),
      TODAY,
    )

    // Assert
    expect(change.type === 'valid' && change.value.rows.slice(7)).toEqual([
      aShortSaturday(),
    ])
  })

  it('should keep the seconds of a time that has some', () => {
    // Act
    const change = readScheduleChange(
      formWith({ 'monday.endTime': '20:00:30' }),
      aSchedule(),
      TODAY,
    )

    // Assert
    expect(change.type === 'valid' && change.value.rows[0]?.endTime).toBe(
      '20:00:30',
    )
  })

  it.each<[string, Record<string, string>, Record<string, LocalizedText>]>([
    [
      'no start',
      { 'monday.startTime': '' },
      { 'monday.startTime': START_MISSING },
    ],
    [
      'a start that is no time',
      { 'tuesday.startTime': '9時' },
      { 'tuesday.startTime': START_MISSING },
    ],
    [
      'no end',
      { 'dates.0.endTime': '' },
      {
        'dates.0.endTime': {
          en: 'Enter the time the work ends.',
          ja: '勤務の終わりの時刻を入力してください。',
        },
      },
    ],
    [
      'an end at the start',
      { 'saturday.endTime': '10:00' },
      {
        'saturday.endTime': {
          en: 'Make the end of the work later than its start. Work cannot run past midnight.',
          ja: '勤務の終わりは、始まりより後の時刻にしてください。日付をまたぐ勤務は入れられません。',
        },
      },
    ],
    [
      'the start of a break without its end',
      { 'saturday.breakStartTime': '12:00' },
      {
        'saturday.breakEndTime': {
          en: 'Enter the end of the break as well. When there is no break, leave both its start and its end empty.',
          ja: '休憩の終わりの時刻も入力してください。休憩がないときは、始まりも終わりも空にします。',
        },
      },
    ],
    [
      'the end of a break without its start',
      { 'monday.breakStartTime': '' },
      {
        'monday.breakStartTime': {
          en: 'Enter the start of the break as well. When there is no break, leave both its start and its end empty.',
          ja: '休憩の始まりの時刻も入力してください。休憩がないときは、始まりも終わりも空にします。',
        },
      },
    ],
    [
      'a break that begins with the work',
      { 'monday.breakStartTime': '09:00' },
      {
        'monday.breakStartTime': {
          en: 'Start the break after the work starts.',
          ja: '休憩は、勤務の始まりより後に始めてください。',
        },
      },
    ],
    [
      'a break that ends where it begins',
      { 'monday.breakEndTime': '13:00' },
      {
        'monday.breakEndTime': {
          en: 'Make the end of the break later than its start.',
          ja: '休憩の終わりは、休憩の始まりより後の時刻にしてください。',
        },
      },
    ],
    [
      'a break that ends with the work',
      { 'monday.breakEndTime': '20:00' },
      {
        'monday.breakEndTime': {
          en: 'End the break before the work ends.',
          ja: '休憩は、勤務の終わりより前に終えてください。',
        },
      },
    ],
    [
      'no date',
      { 'dates.0.date': ' ' },
      {
        'dates.0.date': {
          en: 'Enter a date.',
          ja: '日付を入力してください。',
        },
      },
    ],
    [
      'a date the API does not take',
      { 'dates.0.date': '1899-12-31' },
      {
        'dates.0.date': {
          en: 'Enter a date from January 1, 1900 to December 31, 2999.',
          ja: '日付は、1900 年 1 月 1 日から 2999 年 12 月 31 日までにしてください。',
        },
      },
    ],
    [
      'the date of a row of a day before today',
      { 'dates.0.date': '2026-11-18' },
      {
        'dates.0.date': {
          en: 'This date already has a row among the dates before today.',
          ja: 'この日付の行は、今日より前の日付の行に、すでにあります。',
        },
      },
    ],
  ])(
    'should say what is wrong with %s at its control',
    (_, changed, errors) => {
      // Act
      const change = readScheduleChange(formWith(changed), aSchedule(), TODAY)

      // Assert
      expect(change).toEqual({ type: 'invalid', errors })
    },
  )

  it('should say at the later of two rows of the same date which row it repeats', () => {
    // Act
    const change = readScheduleChange(
      formWith({}, dayOff(1, '2026-11-21')),
      aSchedule(),
      TODAY,
    )

    // Assert
    expect(change).toEqual({
      type: 'invalid',
      errors: {
        'dates.1.date': {
          en: 'This date is the same as that of row 1. A date takes one row.',
          ja: 'この日付は、1 行目と同じです。1 つの日付に入れられるのは 1 行です。',
        },
      },
    })
  })

  it('should take the date of a row of a day before today once those rows are to go', () => {
    // Act
    const change = readScheduleChange(
      formWith({ 'dates.0.date': '2026-11-18' }, [['dropPast', 'on']]),
      aSchedule(),
      TODAY,
    )

    // Assert
    expect(change.type).toBe('valid')
  })

  it('should not ask for the hours of a day off', () => {
    // Act
    const change = readScheduleChange(
      formWith(
        { 'dates.0.works': 'off' },
        [],
        [
          'dates.0.startTime',
          'dates.0.endTime',
          'dates.0.breakStartTime',
          'dates.0.breakEndTime',
        ],
      ),
      aSchedule(),
      TODAY,
    )

    // Assert
    expect(change.type === 'valid' && change.value.rows.at(-1)).toEqual({
      ...aShortSaturday(),
      startTime: null,
      endTime: null,
      isAvailable: false,
    })
  })
})

describe('afterScheduleSave', () => {
  const request: ScheduleRequest = {
    rows: [...aWeek(), aPastDayOff(), aShortSaturday()],
    controls: [...WEEKLY_CONTROLS.slice(0, 6), undefined, 'dates.0'],
  }

  it('should say what the API refused at the controls the rows were written at', () => {
    // Act
    const said = afterScheduleSave(
      {
        type: 'invalid',
        values: [
          { field: '0.endTime', rule: 'custom' },
          { field: '7.date', rule: 'custom' },
        ],
      },
      request,
    )

    // Assert
    expect(said).toEqual({
      message: undefined,
      errors: {
        'monday.endTime': REFUSED_VALUE,
        'dates.0.date': REFUSED_VALUE,
      },
    })
  })

  it.each<[string, string]>([
    ['a row the form does not show', '6.date'],
    ['a value that has no control', '0.dayOfWeek'],
    ['the request as a whole', ''],
  ])(
    'should ask to check what was written when the API refused %s',
    (_, field) => {
      // Act
      const said = afterScheduleSave(
        { type: 'invalid', values: [{ field, rule: 'custom' }] },
        request,
      )

      // Assert
      expect(said).toEqual({
        message: {
          en: 'Check what you entered and try again.',
          ja: '入力した内容を確かめて、もう一度お試しください。',
        },
        errors: {},
      })
    },
  )

  it.each<[string, Parameters<typeof afterScheduleSave>[0], LocalizedText]>([
    [
      'a schedule another account changed meanwhile',
      { type: 'changed', rows: [] },
      {
        en: 'Meanwhile, another account changed this work schedule. What this form holds is not saved yet. Press “Save” again to replace the work schedule with what this form holds. To see the change of the other account, go back to the work schedule with “Cancel”.',
        ja: 'その間に、ほかのアカウントがこの勤務スケジュールを変えていました。このフォームの内容は、まだ保存していません。もう一度「保存する」を押すと、いまの勤務スケジュールを、このフォームの内容で置き換えます。ほかのアカウントの変更を確かめるときは、「やめる」で勤務スケジュールに戻ってください。',
      },
    ],
    [
      'an account that may not plan the schedules',
      { type: 'forbidden' },
      {
        en: 'This account cannot edit work schedules. Only the owners and managers of the salon, and administrators, can edit them.',
        ja: 'このアカウントでは、勤務スケジュールを直せません。勤務スケジュールを直せるのは、サロンのオーナー、マネージャーと、管理者です。',
      },
    ],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      {
        en: 'There are too many requests. Wait a while and try again.',
        ja: 'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
      },
    ],
    [
      'no answer',
      { type: 'failed' },
      {
        en: 'Could not save the work schedule. Check your connection and try again.',
        ja: '勤務スケジュールを保存できませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
  ])('should say what went wrong after %s', (_, outcome, message) => {
    // Act
    const said = afterScheduleSave(outcome, request)

    // Assert
    expect(said).toEqual({ message, errors: {} })
  })
})
