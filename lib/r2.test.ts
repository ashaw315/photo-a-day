// lib/r2.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @aws-sdk/client-s3 before importing r2
vi.mock('@aws-sdk/client-s3', () => {
  const send = vi.fn().mockResolvedValue({});
  return {
    S3Client: vi.fn(function () { return { send }; }),
    PutObjectCommand: vi.fn(function (input: unknown) { return input; }),
    DeleteObjectCommand: vi.fn(function (input: unknown) { return input; }),
  };
});

describe('r2', () => {
  beforeEach(() => {
    process.env.R2_ACCOUNT_ID = 'test-account';
    process.env.R2_ACCESS_KEY_ID = 'test-key';
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret';
    process.env.R2_BUCKET_NAME = 'test-bucket';
    process.env.R2_PUBLIC_URL = 'https://cdn.example.com';
  });

  it('uploadImage uploads buffer and returns public URL', async () => {
    const { uploadImage } = await import('./r2');
    const buffer = Buffer.from('fake-image-data');
    const url = await uploadImage('photos/2026-03-02.jpg', buffer, 'image/jpeg');
    expect(url).toBe('https://cdn.example.com/photos/2026-03-02.jpg');
  });

  it('deleteImage sends delete command', async () => {
    const { deleteImage } = await import('./r2');
    await expect(deleteImage('photos/2026-03-02.jpg')).resolves.not.toThrow();
  });
});
