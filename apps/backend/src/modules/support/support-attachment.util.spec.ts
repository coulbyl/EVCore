import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import {
  assertValidAttachmentRequest,
  extensionForMimeType,
} from './support-attachment.util';

describe('extensionForMimeType', () => {
  it('maps known mime types to their extension', () => {
    expect(extensionForMimeType('image/png')).toBe('.png');
    expect(extensionForMimeType('audio/webm')).toBe('.webm');
    expect(extensionForMimeType('application/pdf')).toBe('.pdf');
  });

  it('returns an empty string for an unknown mime type', () => {
    expect(extensionForMimeType('application/x-nonsense')).toBe('');
  });
});

describe('assertValidAttachmentRequest', () => {
  it('accepts an allowed image within the size limit', () => {
    expect(() =>
      assertValidAttachmentRequest({
        kind: 'IMAGE',
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
      }),
    ).not.toThrow();
  });

  it('rejects a mime type not on the allowlist for the given kind', () => {
    expect(() =>
      assertValidAttachmentRequest({
        kind: 'IMAGE',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects a file over the per-kind size limit', () => {
    expect(() =>
      assertValidAttachmentRequest({
        kind: 'AUDIO',
        mimeType: 'audio/webm',
        sizeBytes: 100 * 1024 * 1024,
      }),
    ).toThrow(BadRequestException);
  });

  it('applies independent limits per kind', () => {
    // A FILE-sized payload should not be silently accepted as an IMAGE just
    // because both share the same generic content type family.
    expect(() =>
      assertValidAttachmentRequest({
        kind: 'IMAGE',
        mimeType: 'image/png',
        sizeBytes: 15 * 1024 * 1024, // over IMAGE's 10MB cap, under FILE's 20MB
      }),
    ).toThrow(BadRequestException);
  });
});
