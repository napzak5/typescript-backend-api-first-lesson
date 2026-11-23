import { text } from '../../languages/localized-text'

/** What the API says of the requests to erase the data of a customer. */
export const customerDeletionRequestMessages = {
  invalidCustomerDeletionRequest: text({
    en: 'Invalid customer deletion request',
    ja: '顧客の削除の依頼の内容が正しくありません',
  }),
  /** `customerId` is the customer and `requestId` the request that is pending. */
  alreadyRequested: (customerId: string, requestId: string) =>
    text({
      en: `Customer ${customerId} has a pending deletion request, ${requestId}`,
      ja: `顧客 ${customerId} には、受け付け中の削除の依頼 ${requestId} があります`,
    }),
}
