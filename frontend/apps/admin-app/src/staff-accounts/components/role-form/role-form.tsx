import type { ModelsSalonRoleType } from '@beauty-salon-frontend/api-client'
import {
  Form,
  type FormErrors,
  NO_ERRORS,
  RadioGroup,
} from '@beauty-salon-frontend/ui'
import type { ReactNode } from 'react'
import { ROLE } from '../../utils/account-form'
import { roleOptionsOf } from '../../utils/account-format'

export type RoleFormProps = {
  /** The roles the account may give */
  roles: readonly ModelsSalonRoleType[]
  /** The role chosen when the form opens: none, so that a role is not given unchecked */
  role?: ModelsSalonRoleType | undefined
  /** What the roles let an account do, and who gives that of an owner */
  description: string
  submitLabel: string
  /** What went wrong with the whole of an attempt */
  message?: string | undefined
  errors?: FormErrors | undefined
  pending?: boolean | undefined
  onSubmit: (values: FormData) => void
  /** What the form says before the choice: where an invitation goes */
  children?: ReactNode
}

/**
 * The choice of a role for the account of a member: the role an
 * invitation gives, or another role for an account that has one. Only the
 * roles the account may give are offered.
 */
export const RoleForm = ({
  roles,
  role,
  description,
  submitLabel,
  message,
  errors = NO_ERRORS,
  pending,
  onSubmit,
  children,
}: RoleFormProps) => (
  <Form
    submitLabel={submitLabel}
    message={message}
    errors={errors}
    pending={pending}
    onSubmit={onSubmit}
  >
    {children}
    <RadioGroup
      label='ロール'
      name={ROLE}
      options={roleOptionsOf(roles)}
      defaultValue={role}
      description={description}
      error={errors[ROLE]}
      required
    />
  </Form>
)
