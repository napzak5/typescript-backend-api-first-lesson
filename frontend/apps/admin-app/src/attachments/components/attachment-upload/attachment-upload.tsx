import {
  Card,
  FileField,
  Form,
  type FormErrors,
  type FormProps,
  NO_ERRORS,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminAttachmentMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Ref } from 'react'
import { ACCEPTED_FILES, FILE } from '../../utils/attachment-file'

const { upload: UPLOAD } = adminAttachmentMessages

export type AttachmentUploadProps = Pick<FormProps, 'pending' | 'onSubmit'> & {
  /** What went wrong with the attempt as a whole, in the language of the page */
  message?: LocalizedText | undefined
  /** What is wrong with the file, under the name of its control. A new object is the answer to another attempt */
  errors?: FormErrors<LocalizedText> | undefined
  /** A file was chosen, or the choice was taken back */
  onChoose: (file: File | undefined) => void
  /** The heading of the form, which takes the focus when the form is empty again after an upload */
  headingRef?: Ref<HTMLHeadingElement> | undefined
}

/**
 * The form that uploads a file to the files of the salon: one file at a
 * time, of a kind and a size the API takes, which the button sends. The
 * control offers the files of those kinds, and the description says what
 * they are, and who sees them. The file chosen is told as it is chosen:
 * the screen keeps it, and reads it when the form is sent.
 */
export const AttachmentUpload = ({
  message,
  errors = NO_ERRORS,
  pending,
  onSubmit,
  onChoose,
  headingRef,
}: AttachmentUploadProps) => {
  const say = useSay()
  const said = useSaidForm(message, errors)

  return (
    <Card title={say(UPLOAD.title)} headingRef={headingRef}>
      <Form
        submitLabel={say(UPLOAD.submit)}
        message={said.message}
        errors={said.errors}
        pending={pending}
        onSubmit={onSubmit}
      >
        <FileField
          name={FILE}
          label={say(UPLOAD.label)}
          accept={ACCEPTED_FILES}
          required
          description={say(UPLOAD.description)}
          error={said.errors[FILE]}
          onChange={(event) => onChoose(event.currentTarget.files?.[0])}
        />
      </Form>
    </Card>
  )
}
