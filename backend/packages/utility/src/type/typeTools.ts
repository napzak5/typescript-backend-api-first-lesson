import type { Except } from 'type-fest'
import type { DeepRequired as _DeepRequired } from 'utility-types'

/** Every property required, at every depth; null stays allowed where it was. */
export type DeepRequired<T> = _DeepRequired<T>

/** `Omit` that only accepts keys the type has. */
export type Omit<ObjectType, KeysType extends keyof ObjectType> = Except<
  ObjectType,
  KeysType
>
