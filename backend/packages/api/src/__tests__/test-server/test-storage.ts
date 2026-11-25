import { S3FileStorage } from '@beauty-salon-backend/infrastructure'
import { startTestStorage } from '@beauty-salon-backend/testing'

/** The bucket that every API of the test server keeps its files in */
const BUCKET = 'attachments-of-the-test-server'

/** The one identity the storage is started with, and that the APIs sign with */
const IDENTITY = {
  accessKeyId: 'test-server-access-key',
  secretAccessKey: 'secret-of-the-test-server-only',
}

/** The storage of the test server, and how it is stopped. */
export type TestFileStorage = {
  fileStorage: S3FileStorage
  stop: () => Promise<void>
}

/**
 * The object storage of the APIs of the test server: the storage of the
 * tests (`startTestStorage`), in a container of its own. The URLs the APIs
 * issue point at the port of the container on this machine, where the
 * tests and a browser send and fetch the files themselves, as a client
 * does at the storage where the system runs. Its preflight answers every
 * origin.
 *
 * The APIs share it: every file is stored under the ID of its attachment,
 * which no other API has. What a test stored stays until the server stops.
 */
export const startTestFileStorage = async (): Promise<TestFileStorage> => {
  const storage = await startTestStorage({ bucket: BUCKET, ...IDENTITY })
  const fileStorage = new S3FileStorage({
    endpoint: storage.endpoint,
    publicEndpoint: storage.endpoint,
    region: 'us-east-1',
    bucket: BUCKET,
    ...IDENTITY,
  })

  return {
    fileStorage,
    stop: async () => {
      fileStorage.close()
      await storage.stop()
    },
  }
}
