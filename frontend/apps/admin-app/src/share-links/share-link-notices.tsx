import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import { ButtonLink, PageHeader } from '@beauty-salon-frontend/ui'
import { attachmentHrefOf } from '../navigation'
import { SHARING_NOTE } from './share-link'

type FileOfTheAddress = { salonId: string; attachmentId: string }

/** The way back to the file of the address */
export const ToTheFile = ({ salonId, attachmentId }: FileOfTheAddress) => (
  <p>
    <ButtonLink href={attachmentHrefOf(salonId, attachmentId)}>
      ファイルへ戻る
    </ButtonLink>
  </p>
)

type SharingForbiddenProps = {
  title: string
  salon: ModelsSalonResponse
  attachmentId: string
}

/** What a screen of the share links says to a role that shares no file: who does, and the way back to the file. */
export const SharingForbidden = ({
  title,
  salon,
  attachmentId,
}: SharingForbiddenProps) => (
  <>
    <PageHeader title={title} description={salon.name} />
    <p>{`このアカウントでは、ファイルを共有できません。${SHARING_NOTE}`}</p>
    <ToTheFile salonId={salon.id} attachmentId={attachmentId} />
  </>
)

/** What the screen of a share link says when there is none to show: none at the address, one revoked, or one of another file. */
export const ShareLinkNotFound = ({
  salonId,
  attachmentId,
}: FileOfTheAddress) => (
  <>
    <PageHeader
      title='共有リンクが見つかりません'
      description='取り消した共有リンクは、表示できません。アドレスが正しいか、お確かめください。'
    />
    <ToTheFile salonId={salonId} attachmentId={attachmentId} />
  </>
)
