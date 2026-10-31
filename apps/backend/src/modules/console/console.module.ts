import { Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth/auth.module';
import { CouponModule } from '@modules/coupon/coupon.module';
import { ConsoleController } from './console.controller';
import { ConsoleRepository } from './console.repository';
import { ConsoleService } from './console.service';

/** The admin's screens (docs/refonte-ui/12-admin.md), phase G. */
@Module({
  imports: [AuthModule, CouponModule],
  controllers: [ConsoleController],
  providers: [ConsoleService, ConsoleRepository],
  exports: [ConsoleService],
})
export class ConsoleModule {}
