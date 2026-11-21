import { OtherSalonNotice } from '@beauty-salon-frontend/salon-screens'
import { ButtonLink } from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'

export type ReportRefusalProps = {
  /** Why there is no report: the account is of another salon, or the salon was removed */
  refusal: 'forbidden' | 'notFound'
  /** What is not shown: 「売上レポート」 */
  what: string
}

/**
 * What a screen of the sales says instead of them: that they are not the
 * account's to see, and the way to those of its own salon; or that the
 * salon was removed since it was read.
 */
export const ReportRefusal = ({ refusal, what }: ReportRefusalProps) =>
  match(refusal)
    .with('forbidden', () => (
      <OtherSalonNotice
        what={what}
        who='そのサロンのオーナーとマネージャーと、管理者'
        start='売上レポート'
      />
    ))
    .with('notFound', () => (
      <>
        <p>{`このサロンは削除されたため、${what}を見られません。`}</p>
        <p>
          <ButtonLink href='/'>トップへ戻る</ButtonLink>
        </p>
      </>
    ))
    .exhaustive()
