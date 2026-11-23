import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import { dayAt, WithSalon } from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  Card,
  type FormErrors,
  PageHeader,
  useNotifications,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
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

const { file: words } = adminCustomerMessages

const TITLE = words.title

/** What the screen says after an attempt */
type Said = {
  message: LocalizedText | undefined
  errors: FormErrors<LocalizedText>
  refused: readonly FileProblem[]
}

const NOTHING_SAID: Said = { message: undefined, errors: {}, refused: [] }

/** A file the browser could not read: moved or removed after it was chosen */
const UNREADABLE: CustomerFileRead = {
  type: 'invalid',
  problems: [{ row: null, column: null, message: words.problems.unreadable }],
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
  const say = useSay()
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
          errors: { [FILE]: words.form.fileWrong },
          refused: [],
        }),
      )
      .with({ type: 'reading' }, () => undefined)
      .with(undefined, () =>
        setSaid({
          message: undefined,
          errors: { [FILE]: words.form.chooseFile },
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
            {say(words.form.cancel)}
          </ButtonLink>
        }
      />
      <Card title={say(words.guide.title)}>
        <p>{say(words.guide.about)}</p>
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
  const say = useSay()

  return (
    <WithSalon salonId={salonId} title={say(TITLE)}>
      {(salon) => (
        <>
          <PageHeader title={say(TITLE)} description={salon.name} />
          <CustomerImport key={salon.id} salon={salon} />
        </>
      )}
    </WithSalon>
  )
}
