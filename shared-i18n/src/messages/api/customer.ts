import { text } from '../../languages/localized-text'

/** What the API says of the customers. */
export const customerMessages = {
  invalidCustomer: text({
    en: 'Invalid customer',
    ja: '顧客の内容が正しくありません',
  }),
  invalidCustomerId: text({
    en: 'Invalid customer ID',
    ja: '顧客の ID が正しくありません',
  }),
  invalidCustomerBatch: text({
    en: 'Invalid customer batch',
    ja: '顧客の一括の取得の指定が正しくありません',
  }),
  invalidCustomers: text({
    en: 'Invalid customers',
    ja: '顧客の一括の登録の内容が正しくありません',
  }),
  invalidCustomerUpdates: text({
    en: 'Invalid customer updates',
    ja: '顧客の一括の変更の内容が正しくありません',
  }),
  invalidCustomerDeletion: text({
    en: 'Invalid customer deletion',
    ja: '顧客の一括の削除の内容が正しくありません',
  }),
  invalidCustomerMerge: text({
    en: 'Invalid customer merge',
    ja: '顧客の統合の内容が正しくありません',
  }),
  invalidCustomerProfile: text({
    en: 'Invalid customer profile',
    ja: '顧客のプロフィールの内容が正しくありません',
  }),
  invalidCustomerProfileUpdate: text({
    en: 'Invalid customer profile update',
    ja: '顧客のプロフィールの変更の内容が正しくありません',
  }),
  invalidCustomerUpdate: text({
    en: 'Invalid customer update',
    ja: '顧客の変更の内容が正しくありません',
  }),
  invalidCustomerExport: text({
    en: 'Invalid customer export',
    ja: '顧客の出力の条件が正しくありません',
  }),
  invalidCustomerSearch: text({
    en: 'Invalid customer search',
    ja: '顧客の検索の条件が正しくありません',
  }),
  noRepeatedCustomer: text({
    en: 'Must not repeat the customer of an earlier item',
    ja: '前の要素と同じ顧客は指定できません',
  }),
  anotherThanPrimary: text({
    en: 'Must be another customer than primaryCustomerId',
    ja: 'primaryCustomerId とは別の顧客にしてください',
  }),
  aCustomerNotDeleted: text({
    en: 'Must be a customer who is not deleted',
    ja: '削除されていない顧客にしてください',
  }),
  notCustomerItself: text({
    en: 'Must not be the customer itself',
    ja: 'その顧客自身にはできません',
  }),
  /** `customerId` is a customer of the request. A screen looks for the ID in the sentence. */
  unfinishedBookingsReferTo: (customerId: string) =>
    text({
      en: `Customer ${customerId} cannot be deleted: bookings that are not finished refer to it`,
      ja: `顧客 ${customerId} は削除できません。終わっていない予約が参照しています`,
    }),
  alreadyHasProfile: text({
    en: 'This account already has a customer profile',
    ja: 'このアカウントには、すでに顧客のプロフィールがあります',
  }),
  confirmEmailFirst: text({
    en: 'Confirm the email address of the account before creating a customer profile',
    ja: '顧客のプロフィールを作る前に、アカウントのメールアドレスを確認してください',
  }),
  entryOfAnotherAccount: text({
    en: 'The customer with the email address of this account belongs to another account',
    ja: 'このアカウントのメールアドレスの顧客は、ほかのアカウントのものです',
  }),
  registeredAtSameMoment: text({
    en: 'A customer with the email address of this account was registered at the same moment; try again',
    ja: 'このアカウントのメールアドレスの顧客が、同時に登録されました。もう一度送ってください',
  }),
  /** `matching` is how many customers match and `most` how many a file holds. */
  tooManyToExport: (matching: number, most: number) =>
    text({
      en: `${matching} customers match; a file holds ${most} at most, so narrow the filters`,
      ja: `条件に合う顧客が ${matching} 人います。1 つのファイルは ${most} 人までなので、条件を絞ってください`,
    }),
  bothAreProfilesOfAccounts: text({
    en: 'Both customers are the profiles of accounts, which a merge cannot make one',
    ja: 'どちらの顧客も、アカウントのプロフィールです。統合では、2 つのアカウントを 1 つにできません',
  }),
  pointsBeyondBalance: text({
    en: 'The points of both customers are more than a balance can hold',
    ja: '2 人の顧客のポイントを合わせると、残高の上限を超えます',
  }),
  /** `list` is a property of a medical chart. */
  chartListsTooLong: (list: string) =>
    text({
      en: `The medical charts of both customers list more ${list} than a chart can; shorten one first`,
      ja: `2 人の顧客のカルテの ${list} を合わせると、1 つのカルテに書ける数を超えます。先に、どちらかを減らしてください`,
    }),
  /** `customerIds` are the customers who asked. */
  deletionRequested: (customerIds: readonly string[]) =>
    text({
      en: `Customer ${customerIds.join(' and customer ')} asked for their data to be erased; cancel the deletion request first`,
      ja: `顧客 ${customerIds.join(' と顧客 ')} は、データの消去を依頼しています。先に、削除の依頼を取り消してください`,
    }),
  /** `customerId` is the customer who was to be restored. */
  notDeleted: (customerId: string) =>
    text({
      en: `Customer ${customerId} is not deleted, so there is nothing to restore`,
      ja: `顧客 ${customerId} は削除されていないので、元に戻すものがありません`,
    }),
  /** `customerId` is the customer who was to be restored. */
  mergedAway: (customerId: string) =>
    text({
      en: `Customer ${customerId} was merged into another customer, who has what it had`,
      ja: `顧客 ${customerId} は、ほかの顧客に統合されました。持っていたものは、その顧客にあります`,
    }),
  /** `customerId` is the customer who was to be restored. */
  erased: (customerId: string) =>
    text({
      en: `The data of customer ${customerId} was erased at their request`,
      ja: `顧客 ${customerId} のデータは、本人の依頼で消去されました`,
    }),
}
