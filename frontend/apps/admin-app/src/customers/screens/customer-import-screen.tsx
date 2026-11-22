import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import { dayAt, WithSalon } from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  Card,
  PageHeader,
  useNotifications,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match } from 'ts-pattern'
import { customersHrefOf } from '../../navigation'
import { registerCustomers } from '../api/customer-bulk-api'
import { CUSTOMER_LISTS } from '../api/customers-api'
import {
  type ChosenFile,
  CustomerImportForm,
  FILE,
} from '../components/customer-import-form/customer-import-form'
import { FileColumns } from '../components/file-columns/file-columns'
import {
  afterRegistration,
  COLUMN_GUIDES,
  type CustomerFileRead,
  type FileCustomer,
  type FileProblem,
  readCustomerFile,
  textOfFile,
} from '../utils/customer-file'

const TITLE = 'CSV から登録する'

/** What the screen says after an attempt */
type Said = {
  message: string | undefined
  errors: Record<string, string>
  refused: readonly FileProblem[]
}

const NOTHING_SAID: Said = { message: undefined, errors: {}, refused: [] }

/** A file the browser could not read: moved or removed after it was chosen */
const UNREADABLE: CustomerFileRead = {
  type: 'invalid',
  problems: [
    {
      row: null,
      column: null,
      message:
        'ファイルを読み込めませんでした。もう一度、ファイルを選んでください。',
    },
  ],
}

type CustomerImportProps = {
  salon: ModelsSalonResponse
}

/**
 * Registers the customers of a CSV file at once: the file is read in the
 * browser as the form of a registration reads one customer, and sent only
 * when every row is right. The API registers all of them or none; after it,
 * the ledger is read anew, with the new customers first.
 */
const CustomerImport = ({ salon }: CustomerImportProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [chosen, setChosen] = useState<ChosenFile | undefined>(undefined)
  const [said, setSaid] = useState<Said>(NOTHING_SAID)
  // The file chosen last: one read after it was replaced is not shown
  const latest = useRef<File | undefined>(undefined)
  const registration = useMutation({
    mutationFn: (customers: readonly FileCustomer[]) =>
      registerCustomers(customers),
    onSuccess: (attempt, customers) =>
      match(afterRegistration(attempt, customers))
        .with({ type: 'done' }, ({ message }) => {
          queryClient.removeQueries({ queryKey: CUSTOMER_LISTS })
          notify({ tone: 'success', message })
          void navigate(customersHrefOf(salon.id))
        })
        .with({ type: 'again' }, ({ message, problems }) =>
          setSaid({ message, errors: {}, refused: problems }),
        )
        .exhaustive(),
  })

  const choose = (file: File | undefined): void => {
    latest.current = file
    setSaid(NOTHING_SAID)
    if (file === undefined) {
      setChosen(undefined)
      return
    }
    setChosen({ type: 'reading' })
    void file
      .arrayBuffer()
      .then((bytes) =>
        readCustomerFile(textOfFile(bytes), dayAt(new Date(), salon.timezone)),
      )
      .catch(() => UNREADABLE)
      .then((read) => {
        if (latest.current === file) {
          setChosen({ type: 'read', read })
        }
      })
  }

  const submit = (): void =>
    match(chosen)
      .with({ type: 'read', read: { type: 'read' } }, ({ read }) => {
        setSaid(NOTHING_SAID)
        registration.mutate(read.customers)
      })
      .with({ type: 'read', read: { type: 'invalid' } }, () =>
        setSaid({
          message: undefined,
          errors: {
            [FILE]:
              'ファイルに誤りがあります。下の一覧を確かめて、直したファイルを選び直してください。',
          },
          refused: [],
        }),
      )
      .with({ type: 'reading' }, () => undefined)
      .with(undefined, () =>
        setSaid({
          message: undefined,
          errors: { [FILE]: 'ファイルを選んでください。' },
          refused: [],
        }),
      )
      .exhaustive()

  return (
    <>
      <CustomerImportForm
        chosen={chosen}
        refused={said.refused}
        onChoose={choose}
        message={said.message}
        errors={said.errors}
        pending={registration.isPending || chosen?.type === 'reading'}
        onSubmit={submit}
        actions={
          <ButtonLink href={customersHrefOf(salon.id)} variant='quiet'>
            やめる
          </ButtonLink>
        }
      />
      <Card title='ファイルの書き方'>
        <p>
          台帳の CSV 出力と同じ形です。1
          行目の列名は、下の表の名前で書きます。表にない台帳の出力の列（id、visitCount、createdAt
          など）は、読み飛ばします。メールアドレスは、ファイルの中でも台帳でも、ほかのお客様と重ならないものにします。
        </p>
        <FileColumns columns={COLUMN_GUIDES} />
      </Card>
    </>
  )
}

/**
 * Registers the customers of a file at once: those of another system, or
 * of a spreadsheet, moved to the ledger.
 */
export const CustomerImportScreen = () => {
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => (
        <>
          <PageHeader title={TITLE} description={salon.name} />
          <CustomerImport key={salon.id} salon={salon} />
        </>
      )}
    </WithSalon>
  )
}
