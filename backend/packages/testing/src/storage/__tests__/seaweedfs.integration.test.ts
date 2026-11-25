import {
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  startTestStorage,
  type TestStorage,
  type TestStorageSettings,
} from '../seaweedfs'

const SETTINGS: TestStorageSettings = {
  bucket: 'bucket-of-the-testing-package',
  accessKeyId: 'testing-package-access-key',
  secretAccessKey: 'secret-of-the-testing-package-only',
}

let storage: TestStorage

beforeAll(async () => {
  storage = await startTestStorage(SETTINGS)
})

afterAll(() => storage.stop())

/** A client of the storage that signs with the identity given, and asks once. */
const clientOf = (
  endpoint: string,
  { accessKeyId, secretAccessKey }: Omit<TestStorageSettings, 'bucket'>,
): S3Client =>
  new S3Client({
    endpoint,
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    maxAttempts: 1,
  })

describe('startTestStorage', () => {
  it('should have the bucket once it is started', async () => {
    // Arrange
    const client = clientOf(storage.endpoint, SETTINGS)

    // Act
    const found = await client.send(
      new HeadBucketCommand({ Bucket: SETTINGS.bucket }),
    )

    // Assert
    expect(found.$metadata.httpStatusCode).toBe(200)
    client.destroy()
  })

  it('should keep a file that is stored with its identity', async () => {
    // Arrange
    const client = clientOf(storage.endpoint, SETTINGS)
    await client.send(
      new PutObjectCommand({
        Bucket: SETTINGS.bucket,
        Key: 'kept.txt',
        Body: 'kept in the storage',
      }),
    )

    // Act
    const stored = await client.send(
      new GetObjectCommand({ Bucket: SETTINGS.bucket, Key: 'kept.txt' }),
    )

    // Assert
    expect(await stored.Body?.transformToString()).toBe('kept in the storage')
    client.destroy()
  })

  it('should refuse a request that signs with another identity', async () => {
    // Arrange
    const client = clientOf(storage.endpoint, {
      accessKeyId: SETTINGS.accessKeyId,
      secretAccessKey: 'a-secret-the-storage-does-not-know',
    })

    // Act
    const refused = client.send(
      new HeadBucketCommand({ Bucket: SETTINGS.bucket }),
    )

    // Assert
    await expect(refused).rejects.toMatchObject({
      $metadata: { httpStatusCode: 403 },
    })
    client.destroy()
  })

  it('should stop the container of the storage', async () => {
    // Arrange
    const stopped = await startTestStorage({
      ...SETTINGS,
      bucket: 'bucket-of-a-storage-that-stops',
    })

    // Act
    await stopped.stop()

    // Assert
    const client = clientOf(stopped.endpoint, SETTINGS)
    await expect(
      client.send(
        new HeadBucketCommand({ Bucket: 'bucket-of-a-storage-that-stops' }),
      ),
    ).rejects.toThrow()
    client.destroy()
  })
})
