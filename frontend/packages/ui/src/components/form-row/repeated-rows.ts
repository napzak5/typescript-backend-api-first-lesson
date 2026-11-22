import { type RefObject, useLayoutEffect, useRef, useState } from 'react'
import type { FormErrors } from '../form/error-focus'
import { NO_ERRORS } from '../form/form-values'

/** A row of a form that repeats the same controls: its key, which stays while the row does, and what the row holds */
export type RepeatedRow<Value> = { key: number; value: Value }

/** The rows of a form that repeats the same controls, and what is done to them */
export type RepeatedRows<Value> = {
  /** The rows, in the order of the form */
  rows: readonly RepeatedRow<Value>[]
  /**
   * What is wrong with the values, to be shown at the controls. An error
   * names a row by its number, and taking a row away renumbers the rows
   * after it: there is none from a row being taken away until the next
   * attempt, which gives a new object
   */
  errors: FormErrors
  /** Adds a row at the end, whose first control takes the focus */
  add: (value: Value) => void
  /** Adds rows at the end that come along with a choice made elsewhere: the focus stays where it is */
  addAlong: (values: readonly Value[]) => void
  /** Takes a row away; the button that adds a row takes the focus */
  remove: (key: number) => void
  /** Changes what a row holds */
  change: (key: number, value: Value) => void
  /** The element of a row (its `FormRow`, its item), whose first control takes the focus when the row is added */
  rowRef: (key: number) => (element: HTMLElement | null) => void
  /** The button that adds a row */
  addRef: RefObject<HTMLButtonElement | null>
}

/** Where the focus goes once the rows have changed */
type Focus = { type: 'row'; key: number } | { type: 'add' } | undefined

/** The controls a row begins with: the first of them takes the focus */
const CONTROLS = 'input, select, textarea'

/**
 * The rows of a form that repeats the same controls (the treatments had
 * before, the options of a service, the dates of a calendar). The browser
 * keeps the values of the controls, so the rows that stay keep what was
 * written in them; a row holds what the form opened it with and what
 * changes the controls it shows. The focus follows in the commit that
 * shows the change: into a row that was added, or to the button that adds
 * one when a row was taken away.
 */
export const useRepeatedRows = <Value>(
  initial: () => readonly Value[],
  errors: FormErrors,
): RepeatedRows<Value> => {
  const [rows, setRows] = useState<RepeatedRow<Value>[]>(() =>
    initial().map((value, key) => ({ key, value })),
  )
  const [nextKey, setNextKey] = useState(rows.length)
  const [focus, setFocus] = useState<Focus>()
  const [outdated, setOutdated] = useState<FormErrors | undefined>(undefined)
  const elements = useRef(new Map<number, HTMLElement>())
  const addRef = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => {
    if (focus?.type === 'row') {
      elements.current
        .get(focus.key)
        ?.querySelector<HTMLElement>(CONTROLS)
        ?.focus()
    }
    if (focus?.type === 'add') {
      addRef.current?.focus()
    }
  }, [focus])

  return {
    rows,
    errors: errors === outdated ? NO_ERRORS : errors,
    add: (value) => {
      setRows([...rows, { key: nextKey, value }])
      setNextKey(nextKey + 1)
      setFocus({ type: 'row', key: nextKey })
    },
    addAlong: (values) => {
      setRows([
        ...rows,
        ...values.map((value, index) => ({ key: nextKey + index, value })),
      ])
      setNextKey(nextKey + values.length)
    },
    remove: (key) => {
      setRows(rows.filter((row) => row.key !== key))
      setOutdated(errors)
      setFocus({ type: 'add' })
    },
    change: (key, value) => {
      setRows(rows.map((row) => (row.key === key ? { key, value } : row)))
    },
    rowRef: (key) => (element) => {
      if (element === null) {
        elements.current.delete(key)
      } else {
        elements.current.set(key, element)
      }
    },
    addRef,
  }
}
