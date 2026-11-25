import { GenericContainer, Wait } from 'testcontainers'

/** The object storage that docker compose runs. */
const IMAGE = 'chrislusf/seaweedfs:4.54'

/** The port of its S3 API in the container. */
const S3_PORT = 8333

/** How long the first start may take, which pulls the image. */
const STARTUP_TIMEOUT_MS = 120_000

/** What the storage of the tests is started with. */
export interface TestStorageSettings {
  /** The one bucket it has. */
  readonly bucket: string
  /** The one identity it knows, which every request signs with. */
  readonly accessKeyId: string
  readonly secretAccessKey: string
}

/** The object storage of the tests, and how it is stopped. */
export interface TestStorage {
  /** Where its S3 API listens, on this machine. */
  readonly endpoint: string
  stop(): Promise<void>
}

/**
 * The object storage of the tests: SeaweedFS, the one that docker compose
 * starts, in a container of its own. It is told its bucket and its one
 * identity when it starts, and it is returned once the bucket is there:
 * the storage answers before it has made it, and it says so in its log.
 * A storage that is not ready in time is stopped, and the start fails.
 */
export const startTestStorage = async ({
  bucket,
  accessKeyId,
  secretAccessKey,
}: TestStorageSettings): Promise<TestStorage> => {
  const container = await new GenericContainer(IMAGE)
    .withCommand([
      'mini',
      '-dir=/data',
      `-bucket=${bucket}`,
      '-master.telemetry=false',
    ])
    .withEnvironment({
      AWS_ACCESS_KEY_ID: accessKeyId,
      AWS_SECRET_ACCESS_KEY: secretAccessKey,
    })
    .withExposedPorts(S3_PORT)
    .withWaitStrategy(
      Wait.forAll([
        Wait.forHttp('/healthz', S3_PORT).forStatusCode(200),
        Wait.forLogMessage(`created bucket ${bucket}`),
      ]),
    )
    .withStartupTimeout(STARTUP_TIMEOUT_MS)
    .start()

  return {
    endpoint: `http://${container.getHost()}:${container.getMappedPort(S3_PORT)}`,
    stop: async () => {
      await container.stop()
    },
  }
}
