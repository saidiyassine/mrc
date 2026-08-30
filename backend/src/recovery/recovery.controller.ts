import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { RecoveryService } from './recovery.service';

@Controller('recovery')
export class RecoveryController {
  constructor(private readonly recoveryService: RecoveryService) {}

  /**
   * Scan all storage sources and Telegram Bot API for candidate players
   */
  @Get('scan')
  async scanUsers() {
    return this.recoveryService.scanUsers();
  }

  /**
   * One-click restore 10 players for GRD100
   */
  @Post('restore-10-grd100')
  async restoreTopTenGrd100(
    @Body()
    body?: {
      bookmaker?: string;
      status?: 'APPROVED' | 'PENDING';
    },
  ) {
    return this.recoveryService.restoreTopTenGrd100(body);
  }

  /**
   * Custom / bulk restore players
   */
  @Post('restore')
  async restorePlayers(
    @Body()
    body: {
      promoCode?: string;
      bookmaker?: string;
      status?: 'APPROVED' | 'PENDING' | 'REJECTED';
      players: {
        telegramChatId: string;
        telegramUsername?: string | null;
        telegramName?: string | null;
        playerBookmakerId?: string | null;
        screenshotUrl?: string | null;
      }[];
    },
  ) {
    return this.recoveryService.restorePlayers(body);
  }

  /**
   * Live lookup of any Telegram user by Chat ID via Telegram Bot API getChat
   */
  @Get('verify/:chatId')
  async verifyUser(@Param('chatId') chatId: string) {
    const result = await this.recoveryService.getTelegramChatInfo(chatId);
    return {
      chatId,
      found: !!result,
      profile: result || null,
    };
  }

  /**
   * Ping / Send notification message to user via Telegram Bot
   */
  @Post('ping')
  async pingUser(
    @Body()
    body: {
      telegramChatId: string;
      message?: string;
    },
  ) {
    return this.recoveryService.sendPingMessage(body.telegramChatId, body.message);
  }
}
