import {
  Card,
  FileField,
  Form,
  type FormProps,
} from '@beauty-salon-frontend/ui'
import type { Ref } from 'react'
import { ACCEPTED_FILES, FILE } from '../../utils/attachment-file'

export type AttachmentUploadProps = Pick<
  FormProps,
  'message' | 'errors' | 'pending' | 'onSubmit'
> & {
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
  errors,
  pending,
  onSubmit,
  onChoose,
  headingRef,
}: AttachmentUploadProps) => (
  <Card title='ファイルをアップロードする' headingRef={headingRef}>
    <Form
      submitLabel='アップロードする'
      message={message}
      errors={errors}
      pending={pending}
      onSubmit={onSubmit}
    >
      <FileField
        name={FILE}
        label='ファイル'
        accept={ACCEPTED_FILES}
        required
        description='JPEG、PNG、WebP の画像か、PDF のファイルを、1 つずつ。10 MB まで。アップロードしたファイルは、このサロンのスタッフのだれもが見られます。'
        error={errors?.[FILE]}
        onChange={(event) => onChoose(event.currentTarget.files?.[0])}
      />
    </Form>
  </Card>
)
