import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  Checkbox,
  Form,
  type FormErrors,
  type FormProps,
  Select,
  TextArea,
  TextField,
} from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import { tagsTextOf } from '../../../customers/customer-ledger'
import {
  CURRENCY_CHOICES,
  coordinateTextOf,
  NEW_SALON,
  type SalonShown,
  TIME_ZONE_CHOICES,
} from '../../salon-form'
import styles from './salon-form.module.css'

/** What the form is opened for. */
type SalonFormSubject =
  /** A salon to be added: the form opens with `NEW_SALON`, and the time zone and the currency are chosen */
  | { type: 'new' }
  /** A salon to be changed, as it was read */
  | { type: 'existing'; salon: ModelsSalonResponse }

export type SalonFormProps = Pick<
  FormProps,
  'submitLabel' | 'message' | 'pending' | 'actions' | 'onSubmit'
> & {
  subject: SalonFormSubject
  /** What is wrong with the values, under the names of the controls. A new object is the answer to another attempt */
  errors?: FormErrors | undefined
}

const NO_ERRORS: FormErrors = {}

const textOrEmpty = (text: string | null): string => text ?? ''

/**
 * The information of a salon: what the customers are shown of it, how it
 * is reached, its photos, what it is known for, the tax it charges and
 * whether it takes bookings online. The time zone and the currency are
 * chosen for a salon to be added, and shown, not changed, for one that is
 * there: the times of its bookings and its prices are read at them.
 */
export const SalonForm = ({
  subject,
  errors = NO_ERRORS,
  ...form
}: SalonFormProps) => {
  const salon: SalonShown =
    subject.type === 'existing' ? subject.salon : NEW_SALON

  return (
    <Form {...form} errors={errors}>
      <fieldset className={styles['part']}>
        <legend className={styles['name']}>サロン</legend>
        <div className={styles['controls']}>
          <TextField
            label='名前'
            name='name'
            autoComplete='organization'
            required
            description='255 文字まで。お客様がサロンを探すときに出ます。'
            defaultValue={salon.name}
            error={errors['name']}
          />
          <TextField
            label='カナ'
            name='nameKana'
            autoComplete='off'
            description='255 文字まで。'
            defaultValue={textOrEmpty(salon.nameKana)}
            error={errors['nameKana']}
          />
          <TextArea
            label='紹介'
            name='description'
            rows={4}
            description='サロンの詳細に出ます。'
            defaultValue={textOrEmpty(salon.description)}
            error={errors['description']}
          />
          <Checkbox
            label='オンライン予約を受け付ける'
            name='isActive'
            description='外すと、お客様は空き枠を見られず、予約できなくなります。サロンが台帳に入れる予約には使えます。'
            defaultChecked={salon.isActive}
          />
        </div>
      </fieldset>
      <fieldset className={styles['part']}>
        <legend className={styles['name']}>所在地</legend>
        <div className={styles['controls']}>
          <div className={styles['pair']}>
            <TextField
              label='郵便番号'
              name='postalCode'
              autoComplete='postal-code'
              description='10 文字まで。'
              defaultValue={textOrEmpty(salon.postalCode)}
              error={errors['postalCode']}
            />
            <TextField
              label='都道府県'
              name='prefecture'
              autoComplete='address-level1'
              required
              defaultValue={salon.prefecture}
              error={errors['prefecture']}
            />
          </div>
          <div className={styles['pair']}>
            <TextField
              label='市区町村'
              name='city'
              autoComplete='address-level2'
              required
              defaultValue={salon.city}
              error={errors['city']}
            />
            <TextField
              label='町名・番地'
              name='address'
              autoComplete='address-line1'
              required
              defaultValue={salon.address}
              error={errors['address']}
            />
          </div>
          <TextField
            label='建物'
            name='building'
            autoComplete='address-line2'
            description='建物の名前と階、部屋の番号。'
            defaultValue={textOrEmpty(salon.building)}
            error={errors['building']}
          />
          <div className={styles['pair']}>
            <TextField
              label='緯度'
              name='latitude'
              inputMode='decimal'
              autoComplete='off'
              description='-90 から 90 まで。地図にサロンを示すときに使います。'
              defaultValue={coordinateTextOf(salon.latitude)}
              error={errors['latitude']}
            />
            <TextField
              label='経度'
              name='longitude'
              inputMode='decimal'
              autoComplete='off'
              description='-180 から 180 まで。'
              defaultValue={coordinateTextOf(salon.longitude)}
              error={errors['longitude']}
            />
          </div>
        </div>
      </fieldset>
      <fieldset className={styles['part']}>
        <legend className={styles['name']}>連絡先</legend>
        <div className={styles['controls']}>
          <div className={styles['pair']}>
            <TextField
              label='電話番号'
              name='phoneNumber'
              type='tel'
              autoComplete='tel'
              required
              description='市外局番から。'
              defaultValue={salon.phoneNumber}
              error={errors['phoneNumber']}
            />
            <TextField
              label='予備の電話番号'
              name='alternativePhone'
              type='tel'
              autoComplete='off'
              defaultValue={textOrEmpty(salon.alternativePhone)}
              error={errors['alternativePhone']}
            />
          </div>
          <TextField
            label='メールアドレス'
            name='email'
            type='email'
            autoComplete='email'
            required
            description='お客様からの問い合わせを受けるアドレス。ほかのサロンと同じアドレスは使えません。'
            defaultValue={salon.email}
            error={errors['email']}
          />
          <TextField
            label='公式サイト'
            name='websiteUrl'
            type='url'
            autoComplete='url'
            description='http:// か https:// で始まる URL。'
            defaultValue={textOrEmpty(salon.websiteUrl)}
            error={errors['websiteUrl']}
          />
        </div>
      </fieldset>
      <fieldset className={styles['part']}>
        <legend className={styles['name']}>写真</legend>
        <div className={styles['controls']}>
          <TextField
            label='ロゴの URL'
            name='logoUrl'
            type='url'
            autoComplete='off'
            defaultValue={textOrEmpty(salon.logoUrl)}
            error={errors['logoUrl']}
          />
          <TextArea
            label='写真の URL'
            name='imageUrls'
            rows={3}
            description='1 行に 1 つ。店舗や内装の写真。'
            defaultValue={salon.imageUrls.join('\n')}
            error={errors['imageUrls']}
          />
        </div>
      </fieldset>
      <fieldset className={styles['part']}>
        <legend className={styles['name']}>特徴と設備</legend>
        <div className={styles['controls']}>
          <TextField
            label='特徴'
            name='features'
            autoComplete='off'
            description='「、」か「,」で区切って書きます。お客様がサロンを探すときに使います。'
            defaultValue={tagsTextOf(salon.features)}
            error={errors['features']}
          />
          <TextField
            label='設備'
            name='amenities'
            autoComplete='off'
            description='Wi-Fi や駐車場など。「、」か「,」で区切って書きます。'
            defaultValue={tagsTextOf(salon.amenities)}
            error={errors['amenities']}
          />
        </div>
      </fieldset>
      <fieldset className={styles['part']}>
        <legend className={styles['name']}>会計</legend>
        <div className={styles['controls']}>
          <TextField
            label='税率（%）'
            name='taxRate'
            inputMode='decimal'
            autoComplete='off'
            required
            description='0 から 100 まで、小数は 2 桁まで。これからの会計の計算に使います。'
            defaultValue={String(salon.taxRate)}
            error={errors['taxRate']}
          />
          {match(subject)
            .with({ type: 'existing' }, () => (
              <p className={styles['note']}>
                {`タイムゾーン（${salon.timezone}）と通貨（${salon.currency}）は、変えられません。予約の日時と料金は、これらで読みます。`}
              </p>
            ))
            .with({ type: 'new' }, () => (
              <div className={styles['pair']}>
                <Select
                  label='タイムゾーン'
                  name='timezone'
                  required
                  options={TIME_ZONE_CHOICES}
                  description='予約の日時は、このタイムゾーンで読みます。登録したあとは、変えられません。'
                  defaultValue={salon.timezone}
                  error={errors['timezone']}
                />
                <Select
                  label='通貨'
                  name='currency'
                  required
                  options={CURRENCY_CHOICES}
                  description='料金と売上は、この通貨で表します。登録したあとは、変えられません。'
                  defaultValue={salon.currency}
                  error={errors['currency']}
                />
              </div>
            ))
            .exhaustive()}
        </div>
      </fieldset>
    </Form>
  )
}
