import type { ModelsStaffSchedule } from '@beauty-salon-frontend/api-client'
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

  it.each<[string, Record<string, string>, Record<string, string>]>([
    [
      'no start',
      { 'monday.startTime': '' },
      { 'monday.startTime': '勤務の始まりの時刻を入力してください。' },
    ],
    [
      'a start that is no time',
      { 'tuesday.startTime': '9時' },
      { 'tuesday.startTime': '勤務の始まりの時刻を入力してください。' },
    ],
    [
      'no end',
      { 'dates.0.endTime': '' },
      { 'dates.0.endTime': '勤務の終わりの時刻を入力してください。' },
    ],
    [
      'an end at the start',
      { 'saturday.endTime': '10:00' },
      {
        'saturday.endTime':
          '勤務の終わりは、始まりより後の時刻にしてください。日付をまたぐ勤務は入れられません。',
      },
    ],
    [
      'the start of a break without its end',
      { 'saturday.breakStartTime': '12:00' },
      {
        'saturday.breakEndTime':
          '休憩の終わりの時刻も入力してください。休憩がないときは、始まりも終わりも空にします。',
      },
    ],
    [
      'the end of a break without its start',
      { 'monday.breakStartTime': '' },
      {
        'monday.breakStartTime':
          '休憩の始まりの時刻も入力してください。休憩がないときは、始まりも終わりも空にします。',
      },
    ],
    [
      'a break that begins with the work',
      { 'monday.breakStartTime': '09:00' },
      {
        'monday.breakStartTime': '休憩は、勤務の始まりより後に始めてください。',
      },
    ],
    [
      'a break that ends where it begins',
      { 'monday.breakEndTime': '13:00' },
      {
        'monday.breakEndTime':
          '休憩の終わりは、休憩の始まりより後の時刻にしてください。',
      },
    ],
    [
      'a break that ends with the work',
      { 'monday.breakEndTime': '20:00' },
      { 'monday.breakEndTime': '休憩は、勤務の終わりより前に終えてください。' },
    ],
    [
      'no date',
      { 'dates.0.date': ' ' },
      { 'dates.0.date': '日付を入力してください。' },
    ],
    [
      'a date the API does not take',
      { 'dates.0.date': '1899-12-31' },
      {
        'dates.0.date':
          '日付は、1900 年 1 月 1 日から 2999 年 12 月 31 日までにしてください。',
      },
    ],
    [
      'the date of a row of a day before today',
      { 'dates.0.date': '2026-11-18' },
      {
        'dates.0.date':
          'この日付の行は、今日より前の日付の行に、すでにあります。',
      },
    ],
  ])(
    'should say what is wrong with %s at its control',
    (_, changed, errors) => {
      expect(readScheduleChange(formWith(changed), aSchedule(), TODAY)).toEqual(
        { type: 'invalid', errors },
      )
    },
  )

  it('should say at the later of two rows of the same date which row it repeats', () => {
    expect(
      readScheduleChange(
        formWith({}, dayOff(1, '2026-11-21')),
        aSchedule(),
        TODAY,
      ),
    ).toEqual({
      type: 'invalid',
      errors: {
        'dates.1.date':
          'この日付は、1 行目と同じです。1 つの日付に入れられるのは 1 行です。',
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
    expect(
      afterScheduleSave(
        {
          type: 'invalid',
          values: [
            { field: '0.endTime', rule: 'custom' },
            { field: '7.date', rule: 'custom' },
          ],
        },
        request,
      ),
    ).toEqual({
      message: undefined,
      errors: {
        'monday.endTime':
          'この値は受け付けられませんでした。入力を確かめてください。',
        'dates.0.date':
          'この値は受け付けられませんでした。入力を確かめてください。',
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
      expect(
        afterScheduleSave(
          { type: 'invalid', values: [{ field, rule: 'custom' }] },
          request,
        ),
      ).toEqual({
        message: '入力した内容を確かめて、もう一度お試しください。',
        errors: {},
      })
    },
  )

  it.each<[string, Parameters<typeof afterScheduleSave>[0], string]>([
    [
      'a schedule another account changed meanwhile',
      { type: 'changed', rows: [] },
      'その間に、ほかのアカウントがこの勤務スケジュールを変えていました。',
    ],
    [
      'an account that may not plan the schedules',
      { type: 'forbidden' },
      'このアカウントでは、勤務スケジュールを直せません。',
    ],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      'アクセスが多すぎます。',
    ],
    [
      'no answer',
      { type: 'failed' },
      '勤務スケジュールを保存できませんでした。',
    ],
  ])('should say what went wrong after %s', (_, outcome, message) => {
    const said = afterScheduleSave(outcome, request)

    expect(said.message).toContain(message)
    expect(said.errors).toEqual({})
  })
})
