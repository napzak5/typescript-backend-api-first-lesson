import type {
  ModelsServiceCategoryResponse,
  ModelsServiceResponse,
} from '@beauty-salon-frontend/api-client'
import {
  CheckboxGroup,
  Form,
  type FormErrors,
  type FormProps,
  Select,
} from '@beauty-salon-frontend/ui'
import { LEVELS, levelNameOf } from '../../../staff/staff-format'
import {
  AVAILABILITY_OPTIONS,
  categoriesById,
  categoryPathOf,
  SERVICE_STATUS_OPTIONS,
} from '../../menu-format'
import {
  MOST_SERVICES,
  NONE,
  SWITCH_OFF,
  SWITCH_ON,
  serviceChoicesOf,
} from '../../services-change'
import styles from './services-change-form.module.css'

export type ServicesChangeFormProps = Pick<
  FormProps,
  'submitLabel' | 'message' | 'pending' | 'actions' | 'onSubmit'
> & {
  /** The categories of the salon, in the order of the menu */
  categories: readonly ModelsServiceCategoryResponse[]
  /** The services of the salon: what may be chosen */
  services: readonly ModelsServiceResponse[]
  /** What is wrong with the values, under the names of the controls. A new object is the answer to another attempt */
  errors?: FormErrors | undefined
}

const NO_ERRORS: FormErrors = {}

const KEEP = '変えない'

const LEVEL_CHOICES = [
  { value: NONE, label: 'すべてのスタッフ' },
  ...LEVELS.map((level) => ({
    value: level,
    label: `${levelNameOf(level)}以上`,
  })),
]

/**
 * The services of the menu to change, and the values to give all of them:
 * the category, whether it is switched on, its state, the days it is
 * given, whether it is booked online and the level of the staff. Every
 * value opens at 「変えない」, and only those that were chosen are sent.
 * What differs from service to service (the price, the time, the options)
 * is changed one service at a time.
 */
export const ServicesChangeForm = ({
  categories,
  services,
  errors = NO_ERRORS,
  ...form
}: ServicesChangeFormProps) => {
  const byId = categoriesById(categories)

  return (
    <Form {...form} errors={errors}>
      <fieldset className={styles['part']}>
        <legend className={styles['name']}>サービス</legend>
        <div className={styles['controls']}>
          <CheckboxGroup
            label='変えるサービス'
            name='serviceIds'
            description={`メニューの順。名前のあとは、カテゴリーです。1 件から ${MOST_SERVICES} 件まで。`}
            options={serviceChoicesOf(categories, services)}
            error={errors['serviceIds']}
          />
        </div>
      </fieldset>
      <fieldset className={styles['part']}>
        <legend className={styles['name']}>変える項目</legend>
        <div className={styles['controls']}>
          <p className={styles['note']}>
            選んだサービスのすべてを、同じ値にします。「変えない」のままの項目は、サービスごとに今のままです。
          </p>
          <Select
            label='カテゴリー'
            name='categoryId'
            placeholder={KEEP}
            options={[
              { value: NONE, label: '未分類にする' },
              ...categories.map((category) => ({
                value: category.id,
                label: categoryPathOf(category, byId),
              })),
            ]}
            defaultValue=''
            error={errors['categoryId']}
          />
          <div className={styles['pair']}>
            <Select
              label='有効'
              name='isActive'
              placeholder={KEEP}
              options={[
                { value: SWITCH_ON, label: '有効にする' },
                { value: SWITCH_OFF, label: '無効にする' },
              ]}
              defaultValue=''
              error={errors['isActive']}
            />
            <Select
              label='オンライン予約'
              name='allowOnlineBooking'
              placeholder={KEEP}
              options={[
                { value: SWITCH_ON, label: '受ける' },
                { value: SWITCH_OFF, label: '受けない' },
              ]}
              defaultValue=''
              error={errors['allowOnlineBooking']}
            />
          </div>
          <div className={styles['pair']}>
            <Select
              label='提供の状態'
              name='serviceStatus'
              placeholder={KEEP}
              options={SERVICE_STATUS_OPTIONS}
              defaultValue=''
              error={errors['serviceStatus']}
            />
            <Select
              label='提供日'
              name='availability'
              placeholder={KEEP}
              options={AVAILABILITY_OPTIONS}
              defaultValue=''
              error={errors['availability']}
            />
          </div>
          <Select
            label='担当できるスタッフ'
            name='requiredStaffLevel'
            placeholder={KEEP}
            options={LEVEL_CHOICES}
            defaultValue=''
            error={errors['requiredStaffLevel']}
          />
        </div>
      </fieldset>
    </Form>
  )
}
