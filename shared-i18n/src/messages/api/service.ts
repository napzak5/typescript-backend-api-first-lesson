import { text } from '../../languages/localized-text'

/** What the API says of the services. */
export const serviceMessages = {
  invalidService: text({
    en: 'Invalid service',
    ja: 'サービスの内容が正しくありません',
  }),
  invalidServiceId: text({
    en: 'Invalid service ID',
    ja: 'サービスの ID が正しくありません',
  }),
  invalidServiceSearch: text({
    en: 'Invalid service search',
    ja: 'サービスの検索の条件が正しくありません',
  }),
  invalidServiceBulkUpdate: text({
    en: 'Invalid service bulk update',
    ja: 'サービスの一括の変更の内容が正しくありません',
  }),
  invalidServiceUpdate: text({
    en: 'Invalid service update',
    ja: 'サービスの変更の内容が正しくありません',
  }),
  notGreaterThanPrice: text({
    en: 'Must not be greater than the price',
    ja: '料金より大きくはできません',
  }),
  emptyUnlessPackage: text({
    en: 'Must be empty unless the service is a package',
    ja: 'サービスがパッケージでないときは、空にしてください',
  }),
  notServiceItself: text({
    en: 'Must not name the service itself',
    ja: 'そのサービス自身は指定できません',
  }),
  servicesOfSameSalon: text({
    en: 'Must name services of the same salon',
    ja: '同じサロンのサービスを指定してください',
  }),
  noPackageAsMember: text({
    en: 'Must not name a package',
    ja: 'パッケージは指定できません',
  }),
  notPackageWhileContained: text({
    en: 'A service that a package contains cannot be a package',
    ja: 'パッケージに含まれているサービスは、パッケージにできません',
  }),
  /** `minimum` is the least number of services a package has. */
  atLeastPackageMembers: (minimum: number) =>
    text({
      en: `A package must name at least ${minimum} services`,
      ja: `パッケージには、サービスを ${minimum} つ以上指定してください`,
    }),
}
