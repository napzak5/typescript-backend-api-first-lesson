import { numberOf } from '../../formats/numbers'
import { type LocalizedText, text } from '../../languages/localized-text'

/**
 * How many there are of something, in the words of each language: English
 * names one differently from many, Japanese counts with one word.
 */
const counted = (
  count: number,
  one: string,
  many: string,
  counter: string,
): LocalizedText => {
  const written = numberOf(count)

  return text({
    en: `${written.en} ${count === 1 ? one : many}`,
    ja: `${written.ja} ${counter}`,
  })
}

/** What the shared components say by themselves, whatever the screen they are on. */
export const uiMessages = {
  close: text({ en: 'Close', ja: '閉じる' }),
  back: text({ en: 'Back', ja: '戻る' }),
  required: text({ en: 'Required', ja: '必須' }),
  loadAgain: text({ en: 'Load again', ja: 'もう一度読み込む' }),
  /** A value that was not recorded: a column that holds nothing */
  notRecorded: text({ en: 'Not recorded', ja: '記録なし' }),
  /** An empty list, a zero and the no of a yes or no: there is none, and that was recorded */
  none: text({ en: 'None', ja: 'なし' }),
  /** A form that is sent with the values it opened with: nothing is sent */
  noChange: text({
    en: 'Nothing was changed.',
    ja: '変更された項目はありません。',
  }),
  /** The words a list is counted with */
  counted: {
    items: (count: number) => counted(count, 'item', 'items', '件'),
    people: (count: number) => counted(count, 'person', 'people', '人'),
    rows: (count: number) => counted(count, 'row', 'rows', '行'),
  },
  appShell: {
    mainMenu: text({ en: 'Main menu', ja: 'メインメニュー' }),
    skipToContent: text({ en: 'Skip to content', ja: '本文へ移動' }),
  },
  filterForm: {
    /** What sending the conditions does: it looks for what was typed */
    search: text({ en: 'Search', ja: '探す' }),
    /** It shows the list as the chosen conditions narrow it */
    view: text({ en: 'Show', ja: '表示する' }),
    /** It counts over the chosen days */
    count: text({ en: 'Calculate', ja: '集計する' }),
    /** The button that opens the other conditions, with how many of them narrow the list */
    conditions: (narrowing: number) =>
      narrowing > 0
        ? text({
            en: `Filters (${numberOf(narrowing).en})`,
            ja: `条件（${numberOf(narrowing).ja}）`,
          })
        : text({ en: 'Filters', ja: '条件' }),
    clear: text({ en: 'Clear filters', ja: '条件を外す' }),
  },
  loadMore: {
    more: text({ en: 'Show more', ja: 'さらに表示' }),
    failed: text({
      en: 'The rest could not be loaded. Check your connection and try again.',
      ja: '続きを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
  pageHeader: {
    otherActions: text({ en: 'More actions', ja: 'ほかの操作' }),
  },
  pagedList: {
    /** How many are shown, of a list the API did not count */
    shown: (shown: LocalizedText) =>
      text({
        en: `Showing ${shown.en}`,
        ja: `${shown.ja}を表示しています`,
      }),
    /** How many there are, and how many of them are shown so far */
    shownOf: (whole: LocalizedText, count: number, shown: LocalizedText) =>
      text({
        en: `${whole.en} (showing ${numberOf(count).en})`,
        ja: `${whole.ja}（${shown.ja}を表示しています）`,
      }),
  },
  passwordField: {
    /**
     * The checkbox that shows what was typed, by the label of its field,
     * which is said already. English puts the label inside the sentence,
     * where it begins with a small letter: the label of a password is a
     * common noun
     */
    show: (label: string) =>
      text({
        en: `Show ${label.toLowerCase()}`,
        ja: `${label}を表示する`,
      }),
  },
  periodSwitch: {
    day: {
      before: text({ en: 'Previous day', ja: '前の日' }),
      current: text({ en: 'Today', ja: '今日' }),
      after: text({ en: 'Next day', ja: '次の日' }),
    },
    week: {
      before: text({ en: 'Previous week', ja: '前の週' }),
      current: text({ en: 'This week', ja: '今週' }),
      after: text({ en: 'Next week', ja: '次の週' }),
    },
  },
  rating: {
    none: text({ en: 'Not rated', ja: '評価なし' }),
    /** How many ratings a mean is the mean of */
    count: (count: number) =>
      text({
        en: `(${numberOf(count).en} ${count === 1 ? 'rating' : 'ratings'})`,
        ja: `（${numberOf(count).ja} 件）`,
      }),
    /** A rating as it is read out, in one piece with what it is out of */
    outOf: (
      highest: number,
      rating: LocalizedText,
      count: LocalizedText | null,
    ) =>
      text({
        en: `${rating.en} out of ${numberOf(highest).en}${count === null ? '' : ` ${count.en}`}`,
        ja: `${numberOf(highest).ja} 段階中 ${rating.ja}${count === null ? '' : count.ja}`,
      }),
  },
}
