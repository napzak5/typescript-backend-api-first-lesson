/**
 * Formats a byte size into a human-readable string
 * @param bytes - The number of bytes
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string (e.g., "1.5 MB", "2.3 KB")
 */
export const formatByteSize = (bytes: number, decimals = 2): string => {
  if (Number.isNaN(bytes) || bytes <= 0) {
    return '0 Bytes'
  }

  const k = 1024
  const dm = Math.max(0, decimals)
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

  const exponent = Math.floor(Math.log(bytes) / Math.log(k))
  const i = Math.min(Math.max(exponent, 0), sizes.length - 1)

  return `${Number.parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`
}
