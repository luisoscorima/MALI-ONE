import { Module } from '@nestjs/common';
import { MalichimpController } from './malichimp.controller';
import { MalichimpService } from './malichimp.service';

@Module({
  controllers: [MalichimpController],
  providers: [MalichimpService],
  exports: [MalichimpService],
})
export class MalichimpModule {}
