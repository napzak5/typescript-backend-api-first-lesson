import { ButtonLink, PageHeader } from '@beauty-salon-frontend/ui'
import { attachmentsHrefOf } from '../../navigation'

/** The way back to the files of the salon */
export const ToTheFiles = ({ salonId }: { salonId: string }) => (
  <ButtonLink href={attachmentsHrefOf(salonId)}>ファイルの一覧へ</ButtonLink>
)

/** What the screen of a file says when there is none to show: none at the address, one removed, or one of another salon. */
export const AttachmentNotFound = ({ salonId }: { salonId: string }) => (
  <>
    <PageHeader
      title='ファイルが見つかりません'
      description='アドレスが正しいか、お確かめください。削除したファイルは、表示できません。'
    />
    <ToTheFiles salonId={salonId} />
  </>
)
