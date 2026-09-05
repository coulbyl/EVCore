import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createLogger } from '@utils/logger';
import { SUPPORT_ATTACHMENT_LIMITS } from '@/config/storage.constants';
import type { HeadObjectResult, UploadUrlRequest } from './storage.types';

const logger = createLogger('storage-service');

// S3-compatible object storage (RustFS in this repo — see docker-compose.yml
// and docs/support-attachments-architecture.md) for support chat
// attachments: voice notes, photos, generic files. Never proxies bytes
// through the Node process — the frontend PUTs directly to the bucket with
// a presigned URL, and reads directly with another one. The bucket itself
// is never public: every URL handed out is short-lived and generated here.
//
// Degrades gracefully rather than crashing bootstrap when unconfigured —
// same pattern as MailService/PushService — so a `pnpm dev` checkout that
// hasn't touched docker-compose's rustfs service still starts; attachment
// endpoints just answer "unavailable" until RUSTFS_ACCESS_KEY/SECRET_KEY are
// set.
@Injectable()
export class StorageService implements OnModuleInit {
  private client: S3Client | null = null;
  // Separate client used ONLY to sign URLs, pointed at the
  // browser-reachable endpoint — which in production differs from the
  // internal Docker-network endpoint this service itself talks to for
  // admin calls (HeadBucket, HeadObject). Same credentials either way; only
  // the host baked into the signature differs.
  private presignClient: S3Client | null = null;
  private bucket = '';

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const accessKeyId = this.config.get<string>('RUSTFS_ACCESS_KEY');
    const secretAccessKey = this.config.get<string>('RUSTFS_SECRET_KEY');
    if (!accessKeyId || !secretAccessKey) {
      logger.warn(
        'RUSTFS_ACCESS_KEY/RUSTFS_SECRET_KEY not set — attachment storage disabled',
      );
      return;
    }

    const endpoint = this.config.get<string>(
      'RUSTFS_ENDPOINT',
      'http://localhost:9000',
    );
    const publicEndpoint = this.config.get<string>(
      'RUSTFS_PUBLIC_ENDPOINT',
      endpoint,
    );
    const region = this.config.get<string>('RUSTFS_REGION', 'us-east-1');
    this.bucket = this.config.get<string>('RUSTFS_BUCKET', 'evcore-support');

    const credentials = { accessKeyId, secretAccessKey };
    // RustFS (like MinIO) is path-style only — virtual-hosted-style bucket
    // subdomains aren't set up here, and forcePathStyle works everywhere.
    this.client = new S3Client({
      endpoint,
      region,
      credentials,
      forcePathStyle: true,
    });
    this.presignClient =
      publicEndpoint === endpoint
        ? this.client
        : new S3Client({
            endpoint: publicEndpoint,
            region,
            credentials,
            forcePathStyle: true,
          });

    await this.ensureBucket();
    logger.info(
      { endpoint, publicEndpoint, bucket: this.bucket },
      'Attachment storage ready',
    );
  }

  isEnabled(): boolean {
    return this.client !== null;
  }

  private async ensureBucket(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      // HeadBucket fails identically (403/404, no distinguishable "not
      // found" code across S3-compatible stores) whether the bucket is
      // missing or merely unreachable — CreateBucket is the safe next
      // step either way: it's idempotent from our side (see catch below).
      try {
        await this.client.send(
          new CreateBucketCommand({ Bucket: this.bucket }),
        );
        logger.info({ bucket: this.bucket }, 'Attachment bucket created');
      } catch (error) {
        // BucketAlreadyOwnedByYou (single-tenant stores like RustFS return
        // this on a second create) is the expected race on a multi-replica
        // backend boot — anything else is a real provisioning failure.
        const code = (error as { name?: string }).name;
        if (
          code !== 'BucketAlreadyOwnedByYou' &&
          code !== 'BucketAlreadyExists'
        ) {
          logger.error(
            { error, bucket: this.bucket },
            'Failed to provision attachment bucket',
          );
        }
      }
    }
  }

  // Presigned PUT — ContentType and ContentLength are signed parameters, so
  // RustFS rejects the upload outright if the client's real request headers
  // don't match exactly what was requested here (see storage.constants.ts).
  async createUploadUrl(input: UploadUrlRequest): Promise<string> {
    if (!this.presignClient) {
      throw new Error('Attachment storage is not configured');
    }
    return getSignedUrl(
      this.presignClient,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.objectKey,
        ContentType: input.contentType,
        ContentLength: input.contentLength,
      }),
      { expiresIn: SUPPORT_ATTACHMENT_LIMITS.UPLOAD_URL_EXPIRY_SECONDS },
    );
  }

  async createDownloadUrl(objectKey: string): Promise<string> {
    if (!this.presignClient) {
      throw new Error('Attachment storage is not configured');
    }
    return getSignedUrl(
      this.presignClient,
      new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }),
      { expiresIn: SUPPORT_ATTACHMENT_LIMITS.DOWNLOAD_URL_EXPIRY_SECONDS },
    );
  }

  // Called after the client reports "upload done" — never trust the
  // client's self-reported size/type a second time when persisting the
  // SupportAttachment row; read back what RustFS actually stored.
  async headObject(objectKey: string): Promise<HeadObjectResult> {
    if (!this.client) {
      throw new Error('Attachment storage is not configured');
    }
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: objectKey }),
      );
      return {
        exists: true,
        contentLength: result.ContentLength ?? null,
        contentType: result.ContentType ?? null,
      };
    } catch {
      return { exists: false, contentLength: null, contentType: null };
    }
  }

  // Best-effort cleanup for an upload-url that was issued but never turned
  // into a message (user cancelled a recording/attachment before sending).
  async deleteObject(objectKey: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }),
      );
    } catch (error) {
      logger.warn({ error, objectKey }, 'Failed to delete orphaned object');
    }
  }
}
