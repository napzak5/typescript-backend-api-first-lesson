import { encode } from 'uqr'
import styles from './qr-code.module.css'

export type QrCodeProps = {
  /** What the code holds: a text, such as an address */
  value: string
  /** What the code is, as it is read out: 「認証アプリで読み取る QR コード」 */
  label: string
}

/** The light modules a reader needs around the code (ISO/IEC 18004) */
const QUIET_ZONE = 4

/**
 * The dark modules of a code, as one outline: a square of one module for
 * each, in the coordinates of the modules.
 */
export const darkModulesOf = (modules: readonly (readonly boolean[])[]) =>
  modules
    .flatMap((row, y) =>
      row.flatMap((dark, x) => (dark ? [`M${x} ${y}h1v1h-1z`] : [])),
    )
    .join('')

/**
 * A QR code, drawn on the page from what it holds: the text is given to no
 * other service, which matters when it is a secret. Dark modules on the
 * surface, with the quiet zone around them; the drawing has the name
 * `label`, and the page says what it holds in words beside it for those who
 * cannot read the code.
 */
export const QrCode = ({ value, label }: QrCodeProps) => {
  const { size, data } = encode(value, { ecc: 'M', border: QUIET_ZONE })

  return (
    <svg
      className={styles['code']}
      viewBox={`0 0 ${size} ${size}`}
      role='img'
      aria-label={label}
      shapeRendering='crispEdges'
    >
      <rect className={styles['light']} width={size} height={size} />
      <path className={styles['dark']} d={darkModulesOf(data)} />
    </svg>
  )
}
