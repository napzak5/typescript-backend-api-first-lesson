import type { ModelsSharedFileResponse } from '@beauty-salon-frontend/api-client'

/*
 * The files of the stories and the tests of the share links: what the API
 * says of the file of a link.
 */

export const photo: ModelsSharedFileResponse = {
  filename: '施術後のスタイル_正面.png',
  contentType: 'image/png',
  size: 348_160,
}

export const consent: ModelsSharedFileResponse = {
  filename: 'カラー同意書_田中様.pdf',
  contentType: 'application/pdf',
  size: 512,
}

/** A PNG image of one pixel, at the address of an object the page holds */
export const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
