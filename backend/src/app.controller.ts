import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import { TelegramService } from './telegram/telegram.service';
import { PrismaService } from './prisma/prisma.service';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';

@Controller()
export class AppController {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('health')
  getHealth() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('stats')
  async getDatabaseStats() {
    const [
      totalUsers,
      promoCodes,
      orders,
      claims,
      telegramStates,
      jobLogs,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.promoCode.findMany({ select: { id: true, bookmaker: true, isActive: true } }),
      this.prisma.order.findMany({ select: { id: true, status: true, targetAccounts: true, claimedCount: true } }),
      this.prisma.playerClaim.findMany({ 
        include: { promoCode: true },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.telegramConversationState.findMany({ select: { telegramChatId: true, step: true, updatedAt: true } }),
      this.prisma.jobLog.findMany({ select: { id: true, status: true, queueName: true } }),
    ]);

    const activePromoCodes = promoCodes.filter(p => p.isActive).length;
    const totalTarget = orders.reduce((s, o) => s + o.targetAccounts, 0);
    const totalClaimed = orders.reduce((s, o) => s + o.claimedCount, 0);
    const fulfillmentRate = totalTarget > 0 ? Math.round((totalClaimed / totalTarget) * 100) : 0;

    const pendingClaims = claims.filter(c => c.status === 'PENDING').length;
    const approvedClaims = claims.filter(c => c.status === 'APPROVED').length;
    const rejectedClaims = claims.filter(c => c.status === 'REJECTED').length;
    const approvalRate = claims.length > 0 ? Math.round((approvedClaims / claims.length) * 100) : 0;

    // Build map of all users/players and their consumed promo codes
    const playersMap: Record<string, {
      telegramChatId: string;
      telegramUsername: string | null;
      telegramName: string | null;
      consumedCount: number;
      promoCodes: {
        code: string;
        bookmaker: string;
        playerBookmakerId: string | null;
        status: string;
        createdAt: Date;
      }[];
      lastActivity: Date;
    }> = {};

    claims.forEach(c => {
      if (!playersMap[c.telegramChatId]) {
        playersMap[c.telegramChatId] = {
          telegramChatId: c.telegramChatId,
          telegramUsername: c.telegramUsername || null,
          telegramName: c.telegramName || null,
          consumedCount: 0,
          promoCodes: [],
          lastActivity: c.createdAt,
        };
      }
      playersMap[c.telegramChatId].consumedCount += 1;
      playersMap[c.telegramChatId].promoCodes.push({
        code: c.promoCode?.code || 'N/A',
        bookmaker: c.promoCode?.bookmaker || 'N/A',
        playerBookmakerId: c.playerBookmakerId || null,
        status: c.status,
        createdAt: c.createdAt,
      });
      if (new Date(c.createdAt) > new Date(playersMap[c.telegramChatId].lastActivity)) {
        playersMap[c.telegramChatId].lastActivity = c.createdAt;
      }
    });

    // Also track users from conversation states who haven't claimed yet
    telegramStates.forEach(t => {
      if (!playersMap[t.telegramChatId]) {
        playersMap[t.telegramChatId] = {
          telegramChatId: t.telegramChatId,
          telegramUsername: null,
          telegramName: null,
          consumedCount: 0,
          promoCodes: [],
          lastActivity: t.updatedAt,
        };
      }
    });

    const playersList = Object.values(playersMap).sort((a, b) => b.consumedCount - a.consumedCount);
    const uniquePlayersWithClaims = claims.length > 0 ? new Set(claims.map(c => c.telegramChatId)).size : 0;
    const totalKnownUserIds = Object.keys(playersMap).length;

    // Bookmaker distribution
    const bookmakerMap: Record<string, { total: number; active: number }> = {};
    promoCodes.forEach(p => {
      if (!bookmakerMap[p.bookmaker]) {
        bookmakerMap[p.bookmaker] = { total: 0, active: 0 };
      }
      bookmakerMap[p.bookmaker].total += 1;
      if (p.isActive) bookmakerMap[p.bookmaker].active += 1;
    });

    const bookmakers = Object.entries(bookmakerMap).map(([bookmaker, stats]) => ({
      bookmaker,
      ...stats,
    }));

    // Orders by status
    const ordersByStatus = {
      ACTIVE: orders.filter(o => o.status === 'ACTIVE').length,
      COMPLETED: orders.filter(o => o.status === 'COMPLETED').length,
      PAUSED: orders.filter(o => o.status === 'PAUSED').length,
      PENDING: orders.filter(o => o.status === 'PENDING').length,
    };

    // Jobs by status
    const jobsByStatus = {
      SUCCESS: jobLogs.filter(j => j.status === 'SUCCESS').length,
      FAILED: jobLogs.filter(j => j.status === 'FAILED').length,
      PENDING: jobLogs.filter(j => j.status === 'PENDING').length,
    };

    // Telegram steps
    const telegramSteps: Record<string, number> = {};
    telegramStates.forEach(t => {
      telegramSteps[t.step] = (telegramSteps[t.step] || 0) + 1;
    });

    return {
      timestamp: new Date().toISOString(),
      database: 'boot_dashboard',
      overview: {
        totalUsers,
        totalPromoCodes: promoCodes.length,
        activePromoCodes,
        totalOrders: orders.length,
        totalTargetAccounts: totalTarget,
        totalClaimedAccounts: totalClaimed,
        fulfillmentRate,
        totalClaims: claims.length,
        pendingClaims,
        approvedClaims,
        rejectedClaims,
        approvalRate,
        uniquePlayersWithClaims,
        totalKnownUserIds,
        totalTelegramStates: telegramStates.length,
        totalJobLogs: jobLogs.length,
      },
      players: playersList,
      bookmakers,
      ordersByStatus,
      claimsByStatus: {
        PENDING: pendingClaims,
        APPROVED: approvedClaims,
        REJECTED: rejectedClaims,
      },
      jobsByStatus,
      telegramSteps,
    };
  }

  @Get('backup')
  async getDatabaseBackup(@Res() res: Response) {
    try {
      const [users, promoCodes, orders, playerClaims, telegramStates, jobLogs] = await Promise.all([
        this.prisma.user.findMany(),
        this.prisma.promoCode.findMany({ include: { orders: true } }),
        this.prisma.order.findMany({ include: { promoCode: true } }),
        this.prisma.playerClaim.findMany({ include: { promoCode: true, order: true } }),
        this.prisma.telegramConversationState.findMany(),
        this.prisma.jobLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
      ]);

      const backup = {
        metadata: {
          exportDate: new Date().toISOString(),
          version: '1.0',
          database: 'boot_dashboard',
          counts: {
            users: users.length,
            promoCodes: promoCodes.length,
            orders: orders.length,
            playerClaims: playerClaims.length,
            telegramStates: telegramStates.length,
            jobLogs: jobLogs.length,
          },
        },
        data: {
          users,
          promoCodes,
          orders,
          playerClaims,
          telegramStates,
          jobLogs,
        },
      };

      const dateStr = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="database-backup-${dateStr}.json"`);
      return res.status(200).send(JSON.stringify(backup, null, 2));
    } catch (err) {
      return res.status(500).json({ error: 'Failed to generate database backup', message: err.message });
    }
  }

  @Get('file/:fileId')
  async getTelegramFile(@Param('fileId') fileId: string, @Res() res: Response) {
    const telegramFileUrl = await this.telegramService.getTelegramFileUrl(fileId);
    if (telegramFileUrl) {
      return res.redirect(302, telegramFileUrl);
    }
    throw new NotFoundException('File not found');
  }

  @Get('uploads/:filename')
  async getUploadFile(@Param('filename') filename: string, @Res() res: Response) {
    const diskPath = path.join(process.cwd(), 'uploads', filename);
    if (fs.existsSync(diskPath)) {
      return res.sendFile(diskPath);
    }
    const fallbackPath = path.join(process.cwd(), 'src', 'claims', 'example-screenshot.png');
    return res.sendFile(fallbackPath);
  }

  @Get('uploads/screenshots/*')
  async getUploadsScreenshot(@Param('0') rest: string, @Res() res: Response) {
    const cleanId = rest.replace(/^\//, '');
    const diskPath = path.join(process.cwd(), 'uploads', 'screenshots', cleanId);
    if (fs.existsSync(diskPath)) {
      return res.sendFile(diskPath);
    }

    const ext = path.extname(cleanId);
    const idWithoutExt = ext ? cleanId.slice(0, -ext.length) : cleanId;

    const telegramFileUrl = (await this.telegramService.getTelegramFileUrl(cleanId))
      || (await this.telegramService.getTelegramFileUrl(idWithoutExt));

    if (telegramFileUrl) {
      return res.redirect(302, telegramFileUrl);
    }

    const fallbackPath = path.join(process.cwd(), 'src', 'claims', 'example-screenshot.png');
    return res.sendFile(fallbackPath);
  }

  @Get('AgA*')
  async handleTelegramFileId(@Param('0') rest: string, @Res() res: Response) {
    const fullId = `AgA${rest}`;
    const telegramFileUrl = await this.telegramService.getTelegramFileUrl(fullId);
    if (telegramFileUrl) {
      return res.redirect(302, telegramFileUrl);
    }
    const fallbackPath = path.join(process.cwd(), 'src', 'claims', 'example-screenshot.png');
    return res.sendFile(fallbackPath);
  }
}
