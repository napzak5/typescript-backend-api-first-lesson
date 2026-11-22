/*
 * Files that a test sends: as little of each kind as the API takes for what
 * its type says. No program opens them.
 */

/** The bytes of a PNG image: its signature, and the start of its header */
export const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
])

/** A PDF as text: its header, and an end */
export const PDF_TEXT =
  '%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n'

/** The bytes of that PDF */
export const PDF_BYTES = new TextEncoder().encode(PDF_TEXT)
