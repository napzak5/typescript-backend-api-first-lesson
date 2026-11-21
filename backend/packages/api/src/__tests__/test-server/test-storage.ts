import { S3FileStorage } from '@beauty-salon-backend/infrastructure'
import {
  GenericContainer,
  type StartedTestContainer,
  Wait,
} from 'testcontainers'

/** The port of the S3 API of SeaweedFS in its container */
const S3_PORT = 8333

/** The bucket that every API of the test server keeps its files in */
const BUCKET = 'attachments-of-the-test-server'

/** The one identity SeaweedFS is started with, and that the APIs sign with */
const IDENTITY = {
  accessKeyId: 'test-server-access-key',
  secretAccessKey: 'secret-of-the-test-server-only',
}

const pause = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

/** The storage answers before its bucket is there: it is looked for until it is. */
const awaitBucket = async (storage: S3FileStorage): Promise<void> => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const looked = await storage.inspect('the-bucket-is-there', 1)
    if (looked.type === 'success') {
      return
    }
    await pause(500)
  }
  throw new Error(`The bucket ${BUCKET} of the test server is not there`)
}

/** The storage of the test server, and how it is stopped. */
export type TestStorage = {
  fileStorage: S3FileStorage
  stop: () => Promise<void>
}

/**
 * The object storage of the APIs of the test server: SeaweedFS, the one that
 * docker compose starts, in a container of its own. The URLs the APIs issue
 * point at the port of the container on this machine, where the tests and
 * a browser send and fetch the files themselves, as a client does at the
 * storage where the system runs. Its preflight answers every origin.
 *
 * The APIs share it: every file is stored under the ID of its attachment,
 * which no other API has. What a test stored stays until the server stops.
 */
export const startTestStorage = async (): Promise<TestStorage> => {
  const container: StartedTestContainer = await new GenericContainer(
    'chrislusf/seaweedfs:4.54',
  )
    .withCommand([
      'mini',
      '-dir=/data',
      `-bucket=${BUCKET}`,
      '-master.telemetry=false',
    ])
    .withEnvironment({
      AWS_ACCESS_KEY_ID: IDENTITY.accessKeyId,
      AWS_SECRET_ACCESS_KEY: IDENTITY.secretAccessKey,
    })
    .withExposedPorts(S3_PORT)
    .withWaitStrategy(Wait.forHttp('/healthz', S3_PORT).forStatusCode(200))
    .withStartupTimeout(120000)
    .start()
  const endpoint = `http://${container.getHost()}:${container.getMappedPort(S3_PORT)}`
  const fileStorage = new S3FileStorage({
    endpoint,
    publicEndpoint: endpoint,
    region: 'us-east-1',
    bucket: BUCKET,
    ...IDENTITY,
  })
  await awaitBucket(fileStorage).catch(async (error: unknown) => {
    fileStorage.close()
    await container.stop()
    return Promise.reject(error)
  })

  return {
    fileStorage,
    stop: async () => {
      fileStorage.close()
      await container.stop()
    },
  }
}
