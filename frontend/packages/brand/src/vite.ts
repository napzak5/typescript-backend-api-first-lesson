import { resolve } from 'node:path'
import type { HtmlTagDescriptor, Plugin } from 'vite'
import * as z from 'zod'
import {
  type Application,
  type ApplicationKey,
  applications,
  PRODUCT_NAME,
} from './index'

/**
 * The variable of the environment that holds the address of each
 * application. An application that links to another reads the address of
 * the other under the same name.
 */
const ORIGIN_VARIABLES: Record<ApplicationKey, string> = {
  portal: 'VITE_PORTAL_APP_URL',
  admin: 'VITE_ADMIN_APP_URL',
  dashboard: 'VITE_DASHBOARD_APP_URL',
}

/** The icons and the image of a shared link, which every application serves at its root */
const PUBLIC_DIRECTORY = resolve(import.meta.dirname, '../public')

/** The image of a shared link (`public/og-image.png`) */
const SHARED_IMAGE = {
  path: '/og-image.png',
  width: '1200',
  height: '630',
  alt: `${PRODUCT_NAME}: サロンの予約と台帳`,
}

/** The color of the frame that a phone draws around the page: that of the header (`--color-surface`) */
const THEME_COLOR = '#ffffff'

const originSchema = z.url({ protocol: /^https?$/ })

const meta = (attrs: Record<string, string>): HtmlTagDescriptor => ({
  tag: 'meta',
  attrs,
  injectTo: 'head',
})

const link = (attrs: Record<string, string>): HtmlTagDescriptor => ({
  tag: 'link',
  attrs,
  injectTo: 'head',
})

/** What the head of every page of an application at an origin says of it */
const headOf = (
  { name, description }: Application,
  origin: string,
): HtmlTagDescriptor[] => [
  { tag: 'title', children: name, injectTo: 'head' },
  meta({ name: 'description', content: description }),
  meta({ name: 'theme-color', content: THEME_COLOR }),
  // One file of the three sizes a browser asks for: the tab, the taskbar, the shortcut
  link({ rel: 'icon', href: '/favicon.ico', sizes: '16x16 32x32 48x48' }),
  link({ rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }),
  meta({ property: 'og:type', content: 'website' }),
  meta({ property: 'og:site_name', content: PRODUCT_NAME }),
  meta({ property: 'og:title', content: name }),
  meta({ property: 'og:description', content: description }),
  meta({ property: 'og:url', content: new URL('/', origin).href }),
  meta({
    property: 'og:image',
    content: new URL(SHARED_IMAGE.path, origin).href,
  }),
  meta({ property: 'og:image:width', content: SHARED_IMAGE.width }),
  meta({ property: 'og:image:height', content: SHARED_IMAGE.height }),
  meta({ property: 'og:image:alt', content: SHARED_IMAGE.alt }),
  meta({ property: 'og:locale', content: 'ja_JP' }),
  meta({ name: 'twitter:card', content: 'summary_large_image' }),
]

/**
 * The brand of an application, in its build and on its development server:
 * the icons and the image of a shared link are served at its root, and the
 * head of its page names the application, its icons and what a link to it
 * shows (Open Graph). A link to it shows an image only at an address that
 * is whole, so the build needs the address of the application, in the
 * variable of the environment that holds it; without it the build fails.
 */
export const brand = (key: ApplicationKey) => {
  const variable = ORIGIN_VARIABLES[key]
  let address: unknown
  // Made at the start, which comes before the first page
  let head: HtmlTagDescriptor[] = []

  return {
    name: 'beauty-salon-brand',
    config: () => ({ publicDir: PUBLIC_DIRECTORY }),
    configResolved: ({ env }: { env: Record<string, unknown> }) => {
      address = env[variable]
    },
    buildStart(this: { error: (message: string) => never }) {
      const origin = originSchema.safeParse(address)
      if (!origin.success) {
        this.error(
          `${variable} is not the address of the application: ${z.prettifyError(origin.error)}`,
        )
      }
      head = headOf(applications[key], origin.data)
    },
    transformIndexHtml: () => head,
  } satisfies Plugin
}
