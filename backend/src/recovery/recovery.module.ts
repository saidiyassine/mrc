import { Module } from '@nestjs/common';
import { RecoveryService } from './recovery.service';
import { RecoveryController } from './recovery.controller';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [TelegramModule],
  controllers: [RecoveryController],
  providers: [RecoveryService, PrismaService],
  exports: [RecoveryService],
})
export class RecoveryModule {}
