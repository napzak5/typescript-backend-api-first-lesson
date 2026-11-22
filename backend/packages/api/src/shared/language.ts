import { type Locale, localeOfAcceptLanguage } from '@beauty-salon-shared/i18n'
import type { Request } from 'express'

/**
 * The language the API answers in when a request asks for none, or for
 * none the API is written in.
 */
const DEFAULT_LANGUAGE: Locale = 'en'

/** The language a request asks to be answered in (`Accept-Language`). */
export const languageAsked = (req: Pick<Request, 'headers'>): Locale =>
  localeOfAcceptLanguage(req.headers['accept-language'], DEFAULT_LANGUAGE)
