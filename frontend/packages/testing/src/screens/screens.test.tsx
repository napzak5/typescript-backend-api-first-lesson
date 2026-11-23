import { useQuery } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLayoutEffect, useState } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import {
  address,
  asTheApplicationKeeps,
  columnsOf,
  firstSight,
  goBack,
  goTo,
  heading,
  notifications,
  optionsOf,
  queryClientOfATest,
  renderApplicationAt,
  rowsOf,
  statusMessages,
  termsOf,
  termsOnceThere,
} from './screens'

/**
 * A screen that says first that it reads, and what it read in the commit
 * after: before the browser paints, so only what looks at the commit that
 * showed the address sees the first.
 */
const Record = () => {
  const { search } = useLocation()
  const [read, setRead] = useState(false)
  useLayoutEffect(() => setRead(true), [])

  return (
    <main>
      <h1>記録</h1>
      <p>{read ? `読んだ記録${search}` : '読んでいます'}</p>
      <Link to='/record?page=2'>次のページ</Link>
      <Link to='/record#notes'>メモ</Link>
      <Link to='/elsewhere'>ほかの画面</Link>
    </main>
  )
}

const Application = () => (
  <Routes>
    <Route path='/record' element={<Record />} />
    <Route path='*' element={<p>枠だけの画面</p>} />
  </Routes>
)

/** How often a read that fails was tried */
let tries = 0

const Reading = () => {
  const { status, data } = useQuery({
    queryKey: ['record'],
    queryFn: () => {
      tries += 1

      return Promise.reject(new Error('The read fails'))
    },
  })

  return <p>{`${status}: ${data ?? 'nothing'}`}</p>
}

/** How often a record was read */
let reads = 0

const ReadingARecord = () => {
  const { data } = useQuery({
    queryKey: ['kept'],
    queryFn: () => {
      reads += 1

      return Promise.resolve(`read ${reads}`)
    },
  })

  return <p>{data ?? 'nothing yet'}</p>
}

/** Three tables: one with the header of a row first, one with it last, one without rows. */
const Tables = () => (
  <>
    <table>
      <caption>スタッフ</caption>
      <thead>
        <tr>
          <th scope='col'>名前</th>
          <th scope='col'>役職</th>
          <th scope='col'>メモ</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope='row'>鈴木 美香</th>
          <td>スタイリスト</td>
          <td />
        </tr>
        <tr>
          <th scope='row'>田中 博</th>
          <td>
            <a href='/roles'>店長</a>
          </td>
          <td>月曜は休み</td>
        </tr>
      </tbody>
    </table>
    <table>
      <caption>スタッフの予定</caption>
      <thead>
        <tr>
          <th scope='col'>日</th>
          <th scope='col'>名前</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>11/20</td>
          <th scope='row'>鈴木 美香</th>
        </tr>
      </tbody>
    </table>
    <table>
      <caption>休み</caption>
      <thead>
        <tr>
          <th scope='col'>日</th>
        </tr>
      </thead>
      <tbody />
    </table>
  </>
)

/** Two selects, the label of one the beginning of the label of the other. */
const Selects = () => (
  <>
    <label>
      担当
      <select>
        <option value=''>指名なし</option>
        <option value='mika'>鈴木 美香</option>
        <option value='hiroshi'>田中 博</option>
      </select>
    </label>
    <label>
      担当の役職
      <select>
        <option value='stylist'>スタイリスト</option>
      </select>
    </label>
  </>
)

describe('the screen tools', () => {
  afterEach(() => {
    cleanup()
    tries = 0
    reads = 0
  })

  describe('renderApplicationAt', () => {
    it('should show the application at the address', () => {
      // Act
      renderApplicationAt(<Application />, '/record')

      // Assert
      expect(screen.getByRole('heading', { name: '記録' })).toBeVisible()
      expect(address()).toBe('/record')
    })

    it.each<[string, string]>([
      ['/record?page=3', '/record?page=3'],
      ['/record?page=3#notes', '/record?page=3#notes'],
      ['/elsewhere#top', '/elsewhere#top'],
    ])(
      'should know the search and the fragment of the address %s',
      (path, expected) => {
        // Act
        renderApplicationAt(<Application />, path)

        // Assert
        expect(address()).toBe(expected)
      },
    )

    it('should follow the application to the address a link leads to', async () => {
      // Arrange
      renderApplicationAt(<Application />, '/record')

      // Act
      await userEvent.click(screen.getByRole('link', { name: 'メモ' }))

      // Assert
      expect(address()).toBe('/record#notes')
    })

    it('should try a read that fails once', async () => {
      // Act
      renderApplicationAt(<Reading />, '/')

      // Assert
      expect(await screen.findByText('error: nothing')).toBeVisible()
      expect(tries).toBe(1)
    })

    it('should read with the client it was given, which keeps what was read', () => {
      // Arrange
      const client = queryClientOfATest()
      client.setQueryData(['record'], 'kept')

      // Act
      renderApplicationAt(<Reading />, '/', { client })

      // Assert
      expect(screen.getByText('success: kept')).toBeVisible()
    })

    it('should give every application a client of its own', async () => {
      // Arrange
      const first = renderApplicationAt(<Reading />, '/')
      await screen.findByText('error: nothing')
      first.unmount()

      // Act
      renderApplicationAt(<Reading />, '/')

      // Assert
      expect(screen.getByText('pending: nothing')).toBeVisible()
    })
  })

  describe('asTheApplicationKeeps', () => {
    it('should not read again what it read, as an application does not for five minutes', async () => {
      // Arrange
      const client = asTheApplicationKeeps()
      const first = renderApplicationAt(<ReadingARecord />, '/', { client })
      await screen.findByText('read 1')
      first.unmount()

      // Act
      renderApplicationAt(<ReadingARecord />, '/', { client })

      // Assert
      expect(screen.getByText('read 1')).toBeVisible()
      expect(client.getQueryState(['kept'])).toMatchObject({
        fetchStatus: 'idle',
        isInvalidated: false,
      })
      expect(client.getDefaultOptions().queries).toEqual({
        retry: false,
        staleTime: 300_000,
      })
      expect(reads).toBe(1)
    })

    it('should read again with the client of a test what was read before', async () => {
      // Arrange
      const client = queryClientOfATest()
      const first = renderApplicationAt(<ReadingARecord />, '/', { client })
      await screen.findByText('read 1')
      first.unmount()

      // Act
      renderApplicationAt(<ReadingARecord />, '/', { client })

      // Assert
      expect(await screen.findByText('read 2')).toBeVisible()
    })

    it('should try a read that fails once', async () => {
      // Act
      renderApplicationAt(<Reading />, '/', {
        client: asTheApplicationKeeps(),
      })

      // Assert
      expect(await screen.findByText('error: nothing')).toBeVisible()
      expect(tries).toBe(1)
    })
  })

  describe('firstSight', () => {
    it('should keep what the page said in the commit that showed the address, not what it said afterwards', async () => {
      // Act
      renderApplicationAt(<Application />, '/record')

      // Assert
      expect(await screen.findByText('読んだ記録')).toBeVisible()
      expect(firstSight()).toEqual([
        '/record',
        expect.stringContaining('読んでいます'),
      ])
    })

    it('should keep the sight of a search of its own, with the search in the address', async () => {
      // Arrange
      renderApplicationAt(<Application />, '/record')
      await screen.findByText('読んだ記録')

      // Act
      await userEvent.click(screen.getByRole('link', { name: '次のページ' }))

      // Assert
      expect(firstSight()).toEqual([
        '/record?page=2',
        expect.stringContaining('読んだ記録?page=2'),
      ])
    })

    it('should keep the sight of the address when the fragment alone changes', async () => {
      // Arrange
      renderApplicationAt(<Application />, '/record')
      await screen.findByText('読んだ記録')

      // Act
      await userEvent.click(screen.getByRole('link', { name: 'メモ' }))

      // Assert
      expect(address()).toBe('/record#notes')
      expect(firstSight()).toEqual([
        '/record',
        expect.stringContaining('読んでいます'),
      ])
    })

    it('should name the address without its fragment', () => {
      // Act
      renderApplicationAt(<Application />, '/record?page=3#notes')

      // Assert
      expect(firstSight()).toEqual([
        '/record?page=3',
        expect.stringContaining('読んでいます'),
      ])
    })

    it('should say nothing of a page without its content', async () => {
      // Arrange
      renderApplicationAt(<Application />, '/record')

      // Act
      await userEvent.click(screen.getByRole('link', { name: 'ほかの画面' }))

      // Assert
      expect(firstSight()).toEqual(['/elsewhere', ''])
    })
  })

  describe('the history', () => {
    it('should lead the application to an address', () => {
      // Arrange
      renderApplicationAt(<Application />, '/elsewhere')

      // Act
      act(() => goTo('/record?page=4'))

      // Assert
      expect(screen.getByRole('heading', { name: '記録' })).toBeVisible()
      expect(address()).toBe('/record?page=4')
    })

    it('should lead back to the address the history has before', async () => {
      // Arrange
      renderApplicationAt(<Application />, '/record', {
        before: ['/first', '/second'],
      })

      // Act
      act(() => goBack())

      // Assert
      await waitFor(() => expect(address()).toBe('/second'))
      expect(screen.getByText('枠だけの画面')).toBeVisible()
    })

    it('should lead back from an address the application was led to', async () => {
      // Arrange
      renderApplicationAt(<Application />, '/elsewhere')
      act(() => goTo('/record'))

      // Act
      act(() => goBack())

      // Assert
      await waitFor(() => expect(address()).toBe('/elsewhere'))
    })
  })

  describe('heading', () => {
    it.each<[string, string | RegExp]>([
      ['its name', '記録'],
      ['a pattern of its name', /^記/],
    ])(
      'should find the heading of the screen by %s, once it is there',
      async (_case, name) => {
        // Arrange: the screen before has a heading of its own
        const view = render(<h1 key='before'>予約台帳</h1>)
        const found = heading(name)

        // Act
        view.rerender(
          <>
            <h1 key='after'>記録</h1>
            <h2>記録のメモ</h2>
          </>,
        )

        // Assert
        expect((await found).outerHTML).toBe('<h1>記録</h1>')
      },
    )

    it('should not take a heading of a part for that of the screen', async () => {
      // Arrange
      render(<h2>記録</h2>)

      // Act, Assert
      await expect(heading('記録')).rejects.toThrow(/Unable to find/)
    })
  })

  describe('what a screen says', () => {
    it('should read the notifications, without the regions that say nothing', () => {
      // Arrange
      render(
        <>
          <p role='status'>保存しました。</p>
          <p role='status' />
          <main>
            <p role='status'>3 件あります</p>
          </main>
        </>,
      )

      // Act, Assert
      expect(notifications()).toEqual(['保存しました。', '3 件あります'])
    })

    it('should read the status messages of the content alone, the empty ones too', () => {
      // Arrange
      render(
        <>
          <p role='status'>枠の通知</p>
          <main>
            <p role='status' />
            <p role='status'>3 件あります</p>
          </main>
        </>,
      )

      // Act, Assert
      expect(statusMessages()).toEqual(['', '3 件あります'])
    })

    it.each<[string, [string, string][]]>([
      [
        '連絡先',
        [
          ['電話番号', '03-1234-5678'],
          ['メールアドレス', 'salon@example.com'],
        ],
      ],
      ['住所', [['都道府県', '東京都']]],
    ])('should read the card %s term by term', (card, terms) => {
      // Arrange
      render(
        <>
          <section aria-label='連絡先'>
            <dl>
              <dt>電話番号</dt>
              <dd>03-1234-5678</dd>
              <dt>メールアドレス</dt>
              <dd>salon@example.com</dd>
            </dl>
          </section>
          <section aria-label='住所'>
            <dl>
              <dt>都道府県</dt>
              <dd>東京都</dd>
            </dl>
          </section>
        </>,
      )

      // Act, Assert
      expect(termsOf(card)).toEqual(terms)
    })

    it('should read a card that comes later, once it is there', async () => {
      // Arrange
      const view = render(<p>読んでいます</p>)
      const terms = termsOnceThere('住所')

      // Act
      view.rerender(
        <>
          <section aria-label='連絡先'>
            <dl>
              <dt>電話番号</dt>
              <dd>03-1234-5678</dd>
            </dl>
          </section>
          <section aria-label='住所'>
            <dl>
              <dt>都道府県</dt>
              <dd>東京都</dd>
              <dt>建物</dt>
            </dl>
          </section>
        </>,
      )

      // Assert
      expect(await terms).toEqual([
        ['都道府県', '東京都'],
        ['建物', ''],
      ])
    })
  })

  describe('columnsOf', () => {
    it('should read the headers of the columns in their order, and none of the headers of the rows', () => {
      // Arrange
      render(<Tables />)

      // Act, Assert
      expect(columnsOf('スタッフ')).toEqual(['名前', '役職', 'メモ'])
    })

    it('should read the table it is handed, and not another one', () => {
      // Arrange
      render(<Tables />)
      const [, plans] = screen.getAllByRole('table')

      // Act, Assert
      expect(plans && columnsOf(plans)).toEqual(['日', '名前'])
    })
  })

  describe('rowsOf', () => {
    it('should read the rows below the column headers, the header of a row with its cells and an empty cell as no text', () => {
      // Arrange
      render(<Tables />)

      // Act, Assert
      expect(rowsOf('スタッフ')).toEqual([
        ['鈴木 美香', 'スタイリスト', ''],
        ['田中 博', '店長', '月曜は休み'],
      ])
    })

    it('should read the cells in the order they stand in, wherever the header of the row is', () => {
      // Arrange
      render(<Tables />)

      // Act, Assert
      expect(rowsOf('スタッフの予定')).toEqual([['11/20', '鈴木 美香']])
    })

    it('should read no rows of a table that has its column headers alone', () => {
      // Arrange
      render(<Tables />)

      // Act, Assert
      expect(rowsOf('休み')).toEqual([])
    })

    it('should read the table it is handed, and not another one', () => {
      // Arrange
      render(<Tables />)
      const [, plans] = screen.getAllByRole('table')

      // Act, Assert
      expect(plans && rowsOf(plans)).toEqual([['11/20', '鈴木 美香']])
    })

    it('should fail when no table has the caption', () => {
      // Arrange
      render(<Tables />)

      // Act, Assert
      expect(() => rowsOf('予約')).toThrow(/Unable to find/)
    })
  })

  describe('optionsOf', () => {
    it('should read what a select offers, in the order of its options, by the label of the select', () => {
      // Arrange
      render(<Selects />)

      // Act, Assert
      expect(optionsOf('担当')).toEqual(['指名なし', '鈴木 美香', '田中 博'])
      expect(optionsOf('担当の役職')).toEqual(['スタイリスト'])
    })

    it('should read the select it is handed, and not another one', () => {
      // Arrange
      render(<Selects />)
      const [, roles] = screen.getAllByRole('combobox')

      // Act, Assert
      expect(roles && optionsOf(roles)).toEqual(['スタイリスト'])
    })

    it('should fail when no select has the label', () => {
      // Arrange
      render(<Selects />)

      // Act, Assert
      expect(() => optionsOf('メニュー')).toThrow(/Unable to find/)
    })
  })
})
