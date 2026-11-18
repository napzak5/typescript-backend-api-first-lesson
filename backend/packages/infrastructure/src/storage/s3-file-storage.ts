import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import {
  type DomainError,
  DomainErrors,
  type FileDownload,
  type FileUpload,
  type IFileStorage,
  type StoredFile,
  type UploadTicket,
} from '@beauty-salon-backend/domain'
import { Result } from '@beauty-salon-backend/utility'
import { match, P } from 'ts-pattern'

export type S3Settings = {
  /** Where the server reaches the storage. */
  endpoint: string
  /**
   * Where a client reaches it. The URLs that are issued name this host and
   * are signed for it; it differs from `endpoint` when the server reaches
   * the storage by a name of its own network.
   */
  publicEndpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
}

/** A storage that is slow to answer must not hold a request for minutes. */
const TIMEOUTS = {
  connectionTimeout: 5_000,
  requestTimeout: 15_000,
}

const clientOf = (endpoint: string, settings: S3Settings): S3Client =>
  new S3Client({
    endpoint,
    region: settings.region,
    // The bucket is part of the path: a storage reached by one host name
    // has no name of its own for every bucket.
    forcePathStyle: true,
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
    },
    // By default the SDK adds a checksum of the body to every upload. A
    // URL is signed before there is a body, so it would carry the checksum
    // of an empty one, and the storage would refuse the upload.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    maxAttempts: 2,
    requestHandler: TIMEOUTS,
  })

/**
 * What a failed call leaves for the log: the verdict of the storage, never
 * a URL, which would carry a signature.
 */
const describeFailure = (error: unknown) => ({
  name: match(error)
    .with({ name: P.string }, ({ name }) => name)
    .otherwise(() => null),
  message: match(error)
    .with({ message: P.string }, ({ message }) => message)
    .otherwise(() => 'The storage failed'),
  status: match(error)
    .with(
      { $metadata: { httpStatusCode: P.number } },
      ({ $metadata }) => $metadata.httpStatusCode,
    )
    .otherwise(() => null),
})

const attempt = async <T>(
  message: string,
  run: () => Promise<T>,
): Promise<Result<T, DomainError>> =>
  Result.mapError(await Result.fromPromise(run()), (cause) =>
    DomainErrors.storage(message, describeFailure(cause)),
  )

/**
 * For how long a URL is signed so that it works until the moment given.
 * A signature counts in whole seconds from a time in whole seconds: the
 * time is the second that has begun, and the seconds are rounded up, so
 * the URL never runs out early and at most a second late. A moment that
 * has passed gives a URL of one second.
 */
const lifetimeUntil = (expiresAt: Date) => {
  const signingDate = new Date(Math.floor(Date.now() / 1000) * 1000)
  const seconds = (expiresAt.getTime() - signingDate.getTime()) / 1000

  return { signingDate, expiresIn: Math.max(1, Math.ceil(seconds)) }
}

/** The size of the whole file, of an answer that holds a part of it. */
const sizeOf = (
  contentRange: string | undefined,
  contentLength: number | undefined,
): number => {
  const total = contentRange?.match(/\/(\d+)$/)?.[1]

  return total === undefined ? (contentLength ?? 0) : Number(total)
}

/**
 * Nothing is stored under the key. Not every 404 says that: a bucket that
 * is not there is a storage that is set up wrongly.
 */
const NOT_STORED = { name: 'NoSuchKey' }

/** A range of an empty file cannot be answered. */
const EMPTY = P.union(
  { name: 'InvalidRange' },
  { $metadata: { httpStatusCode: 416 } },
)

/**
 * Keeps the files in a bucket of an S3-compatible object storage. Which
 * storage it is, is a matter of where the settings point.
 *
 * A URL is a request that is signed with the secret key for one file, one
 * method and the headers named in it, until it runs out: the storage
 * refuses what differs, and the server sees nothing of the transfer.
 * An upload is signed for its type, for its length, and for
 * `If-None-Match: *`, by which the storage takes it only while nothing is
 * stored under the key.
 */
export class S3FileStorage implements IFileStorage {
  private readonly client: S3Client
  private readonly signer: S3Client

  constructor(private readonly settings: S3Settings) {
    this.client = clientOf(settings.endpoint, settings)
    this.signer = clientOf(settings.publicEndpoint, settings)
  }

  async issueUpload(
    file: FileUpload,
    expiresAt: Date,
  ): Promise<Result<UploadTicket, DomainError>> {
    return attempt('Failed to sign the upload URL', async () => ({
      url: await getSignedUrl(
        this.signer,
        new PutObjectCommand({
          Bucket: this.settings.bucket,
          Key: file.key,
          ContentType: file.contentType,
          ContentLength: file.size,
          IfNoneMatch: '*',
        }),
        {
          ...lifetimeUntil(expiresAt),
          // The presigner leaves the type out of a signature unless it is
          // named here. The length and the precondition are signed as the
          // headers of the request they are.
          signableHeaders: new Set(['content-type']),
        },
      ),
      // The length is not among them: a client states it by sending the
      // body, and a browser lets no script set it.
      headers: { 'Content-Type': file.contentType, 'If-None-Match': '*' },
    }))
  }

  async inspect(
    key: string,
    leadingBytes: number,
  ): Promise<Result<StoredFile | null, DomainError>> {
    const read = await Result.fromPromise(
      this.client
        .send(
          new GetObjectCommand({
            Bucket: this.settings.bucket,
            Key: key,
            Range: `bytes=0-${leadingBytes - 1}`,
          }),
        )
        .then(async ({ Body, ContentRange, ContentLength }) => ({
          size: sizeOf(ContentRange, ContentLength),
          head: (await Body?.transformToByteArray()) ?? new Uint8Array(),
        })),
    )

    return match(read)
      .returnType<Result<StoredFile | null, DomainError>>()
      .with({ type: 'success' }, ({ data }) => Result.success(data))
      .with({ type: 'error', error: NOT_STORED }, () => Result.success(null))
      .with({ type: 'error', error: EMPTY }, () =>
        Result.success({ size: 0, head: new Uint8Array() }),
      )
      .with({ type: 'error' }, ({ error }) =>
        Result.error(
          DomainErrors.storage(
            'Failed to read the stored file',
            describeFailure(error),
          ),
        ),
      )
      .exhaustive()
  }

  async issueDownload(
    file: FileDownload,
    expiresAt: Date,
  ): Promise<Result<string, DomainError>> {
    return attempt('Failed to sign the download URL', () =>
      getSignedUrl(
        this.signer,
        new GetObjectCommand({
          Bucket: this.settings.bucket,
          Key: file.key,
          ResponseContentType: file.contentType,
          ResponseContentDisposition: file.contentDisposition,
        }),
        lifetimeUntil(expiresAt),
      ),
    )
  }

  async remove(key: string): Promise<Result<null, DomainError>> {
    return attempt('Failed to remove the stored file', async () => {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.settings.bucket, Key: key }),
      )

      return null
    })
  }

  /** Closes the connections that are kept open to the storage. */
  close(): void {
    this.client.destroy()
    this.signer.destroy()
  }
}
