import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  private deleteScreenshotFromDisk(screenshotUrl?: string | null) {
    if (!screenshotUrl || screenshotUrl === 'simulated_screenshot' || screenshotUrl === 'telegram_file_uploaded') {
      return;
    }
    try {
      const rawId = screenshotUrl.replace(/^\/claims\/screenshot\//, '').replace(/^\/uploads\/screenshots\//, '').replace(/^\//, '');
      const ext = path.extname(rawId);
      const fileId = ext ? rawId.slice(0, -ext.length) : rawId;
      const screenshotsDir = path.join(process.cwd(), 'uploads', 'screenshots');

      for (const name of [rawId, fileId, `${fileId}.jpg`, `${fileId}.jpeg`, `${fileId}.png`, `${fileId}.webp`]) {
        const p = path.join(screenshotsDir, name);
        if (fs.existsSync(p)) {
          try {
            fs.unlinkSync(p);
          } catch (_) {}
        }
      }
    } catch (err) {
      console.error('Error deleting screenshot file from disk:', err);
    }
  }

  async findAll() {
    const orders = await this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        promoCode: true,
        claims: {
          select: { id: true, status: true, telegramChatId: true }
        }
      },
    });

    return orders.map(order => ({
      ...order,
      claimedCount: order.claims ? order.claims.filter(c => c.status === 'APPROVED').length : order.claimedCount,
    }));
  }

  async create(data: {
    promoCodeId: string;
    targetAccounts: number;
    freeDepositConditions: string;
    telegramChannelUrl?: string;
  }) {
    // Verify promo code exists
    const promo = await this.prisma.promoCode.findUnique({
      where: { id: data.promoCodeId },
    });

    if (!promo) throw new NotFoundException('Promo code not found');

    return this.prisma.order.create({
      data: {
        promoCodeId: data.promoCodeId,
        targetAccounts: Number(data.targetAccounts),
        freeDepositConditions: data.freeDepositConditions,
        telegramChannelUrl: data.telegramChannelUrl ? data.telegramChannelUrl.trim() : null,
        status: 'ACTIVE',
      },
      include: { promoCode: true },
    });
  }

  async updateStatus(id: string, status: 'ACTIVE' | 'PAUSED' | 'COMPLETED') {
    return this.prisma.order.update({
      where: { id },
      data: { status },
      include: { promoCode: true },
    });
  }

  async delete(id: string) {
    // 1. Find all player claims linked to this campaign/order
    const claims = await this.prisma.playerClaim.findMany({
      where: { orderId: id },
      select: { id: true, screenshotUrl: true },
    });

    // 2. Delete physical image/screenshot files from disk to save storage
    for (const claim of claims) {
      if (claim.screenshotUrl) {
        this.deleteScreenshotFromDisk(claim.screenshotUrl);
      }
    }

    // 3. Clear screenshotUrl for these player records
    await this.prisma.playerClaim.updateMany({
      where: { orderId: id },
      data: { screenshotUrl: null },
    });

    // 4. Delete the order (campaign) - player claims remain safely in DB with orderId = null
    return this.prisma.order.delete({ where: { id } });
  }

  async getActiveOrderForBot() {
    // Fetch the most recent active order that still needs target accounts
    return this.prisma.order.findFirst({
      where: {
        status: 'ACTIVE',
        promoCode: { isActive: true },
      },
      orderBy: { createdAt: 'desc' },
      include: { promoCode: true },
    });
  }
}
