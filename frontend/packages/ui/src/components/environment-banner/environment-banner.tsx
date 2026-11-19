import type { RuntimeMode } from '@beauty-salon-frontend/config'
import { match } from 'ts-pattern'
import styles from './environment-banner.module.css'

export type EnvironmentBannerProps = {
  environment: RuntimeMode
}

/**
 * Says which environment the page belongs to, in a corner of the window, so
 * that nobody takes a test environment for the real one. Production shows
 * nothing.
 */
export const EnvironmentBanner = ({ environment }: EnvironmentBannerProps) =>
  match(environment)
    .with('production', () => null)
    .with('staging', 'development', 'test', 'localhost', (name) => (
      <p className={styles['banner']} data-environment={name}>
        {name}
      </p>
    ))
    .exhaustive()
