import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';

// Generic S3-compatible storage — not support-chat-specific despite its
// only current consumer, so a future feature needing file storage (avatar
// uploads, coupon exports, …) reuses this instead of standing up its own
// client.
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
