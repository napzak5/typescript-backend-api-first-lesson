import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { fn } from 'storybook/test'
import { Button } from '../button/button'
import { Checkbox } from '../checkbox/checkbox'
import { FieldRow } from '../field-row/field-row'
import type { FormErrors } from '../form/error-focus'
import { FormPart } from '../form-part/form-part'
import { TextField } from '../text-field/text-field'
import { FormRow } from './form-row'
import { useRepeatedRows } from './repeated-rows'

const meta: Meta<typeof FormRow> = {
  title: 'Components/FormRow',
  component: FormRow,
  args: {
    label: '1 件目の施術',
    children: (
      <>
        <FieldRow>
          <TextField label='施術' name='rows.0.treatment' autoComplete='off' />
          <TextField
            label='施術日'
            name='rows.0.date'
            autoComplete='off'
            type='date'
          />
        </FieldRow>
        <Button size='small' onClick={fn()}>
          外す
        </Button>
      </>
    ),
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** A service of a package: its name, and whether a member is chosen for it */
type Packaged = { name: string; nominated: boolean }

type PackageProps = {
  /** The services the form opens with */
  services: readonly Packaged[]
  errors: FormErrors
}

/**
 * The services of a package, as a form keeps them with `useRepeatedRows`:
 * the box that makes the package brings two rows along, a row is added at
 * the end and taken away, and the box of a row shows a control of its own.
 */
const PackageRows = ({ services, errors }: PackageProps) => {
  const [isPackage, setIsPackage] = useState(services.length > 0)
  const packaged = useRepeatedRows(() => services, errors)

  return (
    <FormPart label='セットのメニュー'>
      <Checkbox
        label='セットのメニューにする'
        name='isPackage'
        checked={isPackage}
        onChange={(event) => {
          setIsPackage(event.currentTarget.checked)
          if (event.currentTarget.checked && packaged.rows.length === 0) {
            packaged.addAlong([
              { name: '', nominated: false },
              { name: '', nominated: false },
            ])
          }
        }}
      />
      {isPackage && (
        <>
          {packaged.rows.map((row, index) => (
            <FormRow
              key={row.key}
              ref={packaged.rowRef(row.key)}
              label={`${index + 1} つ目のサービス`}
            >
              <TextField
                label='サービス'
                name={`services.${index}.name`}
                autoComplete='off'
                defaultValue={row.value.name}
                error={packaged.errors[`services.${index}.name`]}
              />
              <Checkbox
                label='スタッフを指名する'
                name={`services.${index}.nominated`}
                checked={row.value.nominated}
                onChange={(event) =>
                  packaged.change(row.key, {
                    ...row.value,
                    nominated: event.currentTarget.checked,
                  })
                }
              />
              {row.value.nominated && (
                <TextField
                  label='スタッフ'
                  name={`services.${index}.staff`}
                  autoComplete='off'
                />
              )}
              <Button
                size='small'
                aria-label={`${index + 1} つ目のサービスを外す`}
                onClick={() => packaged.remove(row.key)}
              >
                外す
              </Button>
            </FormRow>
          ))}
          <Button
            ref={packaged.addRef}
            onClick={() => packaged.add({ name: '', nominated: false })}
          >
            サービスを足す
          </Button>
        </>
      )}
    </FormPart>
  )
}

/** Rows that are added and taken away: the error of the first row is shown until a row is taken away */
export const Repeated: Story = {
  render: () => (
    <PackageRows
      services={[
        { name: 'カット', nominated: false },
        { name: 'カラー', nominated: true },
      ]}
      errors={{ 'services.0.name': 'サービスを選んでください。' }}
    />
  ),
}

/** No rows yet: the box brings two along */
export const RepeatedFromNone: Story = {
  render: () => <PackageRows services={[]} errors={{}} />,
}

/** The rows of a part of a form, one below the other */
export const InAPart: Story = {
  render: (args) => (
    <FormPart label='過去の施術'>
      <FormRow {...args} />
      <FormRow label='2 件目の施術'>
        <TextField label='施術' name='rows.1.treatment' autoComplete='off' />
      </FormRow>
    </FormPart>
  ),
}
