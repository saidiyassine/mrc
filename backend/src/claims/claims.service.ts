import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class ClaimsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
  ) {}

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

  /**
   * Synchronizes an order's claimedCount with actual APPROVED claims count,
   * and marks the order COMPLETED only when approvedCount >= targetAccounts.
   * If approvedCount falls below targetAccounts, it reopens completed orders to ACTIVE.
   */
  async syncOrderStatus(orderId?: string | null) {
    if (!orderId) return;
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { claims: { select: { status: true } } },
      });
      if (!order) return;

      const approvedCount = order.claims.filter(c => c.status === 'APPROVED').length;
      let newStatus = order.status;

      if (order.targetAccounts > 0 && approvedCount >= order.targetAccounts) {
        newStatus = 'COMPLETED';
      } else if (order.status === 'COMPLETED' && approvedCount < order.targetAccounts) {
        newStatus = 'ACTIVE';
      }

      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          claimedCount: approvedCount,
          status: newStatus,
        },
      });
    } catch (err) {
      console.error(`Error syncing order progress for order ${orderId}:`, err);
    }
  }

  async create(data: {
    telegramChatId: string;
    telegramUsername?: string;
    telegramName?: string;
    promoCodeId: string;
    orderId: string;
    playerBookmakerId: string;
    screenshotUrl?: string;
    status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  }) {
    // Validate uniqueness globally
    const existing = await this.prisma.playerClaim.findFirst({
      where: { playerBookmakerId: data.playerBookmakerId },
    });
    if (existing) {
      throw new BadRequestException('ID bookmaker déjà utilisé par un autre joueur.');
    }

    const claim = await this.prisma.playerClaim.create({
      data: {
        telegramChatId: data.telegramChatId,
        telegramUsername: data.telegramUsername,
        telegramName: data.telegramName,
        promoCodeId: data.promoCodeId,
        orderId: data.orderId,
        playerBookmakerId: data.playerBookmakerId,
        screenshotUrl: data.screenshotUrl || 'simulated_screenshot',
        status: data.status || 'PENDING',
      },
      include: {
        promoCode: true,
        order: true,
      },
    });

    // Synchronize order progress based on approved claims
    await this.syncOrderStatus(data.orderId);

    return claim;
  }

  async findAll() {
    return this.prisma.playerClaim.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        promoCode: true,
        order: true,
      },
    });
  }

  async updateStatus(id: string, status: 'APPROVED' | 'REJECTED', reason?: string) {
    const claim = await this.prisma.playerClaim.findUnique({
      where: { id },
      include: { promoCode: true, order: true },
    });

    if (!claim) throw new NotFoundException('Player claim record not found');

    const updatedClaim = await this.prisma.playerClaim.update({
      where: { id },
      data: { status },
      include: { promoCode: true, order: true },
    });

    // Synchronize order status based on updated approved count
    if (claim.orderId) {
      await this.syncOrderStatus(claim.orderId);
    }

    // Notify the player via Telegram in Arabic / Moroccan Darija
    try {
      let channelUrl = claim.order?.telegramChannelUrl || 'https://t.me/MARROCCINHO_FREE_SOLD';
      if (channelUrl.startsWith('@')) channelUrl = `https://t.me/${channelUrl.substring(1)}`;
      else if (!channelUrl.startsWith('http://') && !channelUrl.startsWith('https://')) channelUrl = `https://t.me/${channelUrl}`;

      if (status === 'APPROVED') {
        const inline_keyboard = [
          [{ text: '📢 رابط القناة لمتابعة العروض الجديدة', url: channelUrl }],
        ];

        await this.telegramService.sendMessage(
          claim.telegramChatId,
          `🎉 <b>مبروك عليك! تم تفعيل الحساب ديالك بنجاح!</b> 🎁\n\n` +
          `الطلب ديالك ديال الديبو فابور فـ <b>${claim.promoCode.bookmaker}</b> (الكود برومو: <code>${claim.promoCode.code}</code>) تم <b>الموافقة عليه</b> وتفعل البونص فـ الحساب ديالك بنجاح! 💰🔥\n\n` +
          `📌 <b>شرط سحب الأرباح :</b>\n` +
          `خاصك تبدأ تلعب وتراهن بالحساب ديالك وتطلع الرصيد لـ <b>5,000 درهم (5000 DH)</b> أو أكثر من بعد الرهان! 🎯\n\n` +
          `⏳ <b>تنبيه عاجل ومهم بزاف (فرصة 24 ساعة فقط!):</b>\n` +
          `خاصك تبدأ تلعب فـ <u>أقرب وقت قبل ما تفوت 24 ساعة</u>! ⚠️\n` +
          `سحب الأرباح غادي يتحل <b>غداً رسمياً</b>، واللاعبين اللي لعبوا وطلعوا الرصيد ديالهم لـ 5,000 DH هما لغادي يقدروا يسحبوا فلوسهم كاش فـ البلاصة! 💸🚀\n\n` +
          `⚡️ <b>لا تضيع هاد الفرصة الذهبية! ادخل دابا للحساب ديالك، ابدأ اللعب فـ البلاصة، طلع الرصيد لـ 5000 DH وحضر راسك للسحب ديال غداً!</b> 🔥\n\n` +
          `📢 <b>البلاصة فين كنعلنو على العروض الجديدة هي هنا :</b>\n👉 ${channelUrl}`,
          { inline_keyboard },
        );
      } else {
        const inline_keyboard = [
          [
            { text: '🎁 عرض عروض أخرى', callback_data: 'show_offers' },
          ],
        ];

        const reasonLine = reason
          ? `\n\n📋 <b>سبب الرفض :</b>\n<i>${reason}</i>`
          : '';

        await this.telegramService.sendMessage(
          claim.telegramChatId,
          `❌ <b>تم رفض الطلب ديالك</b>\n\n` +
          `للأسف، التحقق من الحساب ديالك فـ <b>${claim.promoCode.bookmaker}</b> (الكود برومو: <code>${claim.promoCode.code}</code>) ما تقبلش. ⚠️` +
          reasonLine +
          `\n\n🎁 <b>تقدر تستافد من عروض أخرى متوفرة!</b>\n` +
          `اضغط على الزر أسفله باش تشوف باقي العروض :`,
          { inline_keyboard },
        );
      }
    } catch (err) {
      console.error(`Could not notify Telegram player ${claim.telegramChatId}:`, err);
    }

    return updatedClaim;
  }

  async deleteClaim(id: string) {
    const claim = await this.prisma.playerClaim.findUnique({
      where: { id },
      include: { promoCode: true, order: true },
    });

    if (!claim) throw new Error('Demande introuvable');

    // Delete screenshot image from disk to save storage
    if (claim.screenshotUrl) {
      this.deleteScreenshotFromDisk(claim.screenshotUrl);
    }

    // Delete the claim record
    await this.prisma.playerClaim.delete({ where: { id } });

    // Sync order progress
    if (claim.orderId) {
      await this.syncOrderStatus(claim.orderId);
    }

    // Also reset player's conversation state so they can restart cleanly
    await this.prisma.telegramConversationState.updateMany({
      where: { telegramChatId: claim.telegramChatId },
      data: { step: 'IDLE', currentOrderId: null, metadata: null },
    });

    // Notify player via Telegram
    try {
      const inline_keyboard = [
        [
          { text: '🔄 إعادة التسجيل', callback_data: `select_order_${claim.orderId}` },
        ],
        [
          { text: '🎁 مشاهدة العروض', callback_data: 'show_offers' },
        ],
      ];

      await this.telegramService.sendMessage(
        claim.telegramChatId,
        `🗑️ <b>تم حذف طلبك</b>\n\n` +
        `مرحباً ! تم حذف طلبك المتعلق بـ <b>${claim.promoCode.bookmaker}</b> (الكود برومو: <code>${claim.promoCode.code}</code>) من طرف المسؤول.\n\n` +
        `✅ <b>يمكنك الآن إعادة التسجيل أو تصحيح معلوماتك.</b>\n` +
        `اضغط على الزر أسفله للمحاولة من جديد :`,
        { inline_keyboard },
      );
    } catch (err) {
      console.error(`Could not notify player ${claim.telegramChatId}:`, err);
    }

    return { success: true, message: 'Demande supprimée avec succès' };
  }

  /**
   * Bulk add / inject promo code consumptions for specific or generated user IDs
   */
  async bulkAddConsumptions(data: {
    promoCodeId: string;
    userInputs: string; // e.g. "10" or "123456789, 987654321"
    status?: 'APPROVED' | 'PENDING' | 'REJECTED';
  }) {
    const promoCode = await this.prisma.promoCode.findUnique({
      where: { id: data.promoCodeId },
    });
    if (!promoCode) throw new NotFoundException('Code promo introuvable');

    // Find or create an order for this promo code
    let order = await this.prisma.order.findFirst({
      where: { promoCodeId: promoCode.id, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });

    if (!order) {
      order = await this.prisma.order.findFirst({
        where: { promoCodeId: promoCode.id },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!order) {
      order = await this.prisma.order.create({
        data: {
          promoCodeId: promoCode.id,
          targetAccounts: 50,
          claimedCount: 0,
          freeDepositConditions: `Inscription avec le code ${promoCode.code} sur ${promoCode.bookmaker}`,
          status: 'ACTIVE',
        },
      });
    }

    const trimmedInput = (data.userInputs || '').trim();
    let chatIdsToProcess: { chatId: string; name?: string; username?: string }[] = [];

    const isNumericCount = /^\d{1,3}$/.test(trimmedInput) && Number(trimmedInput) > 0 && Number(trimmedInput) <= 100;

    if (isNumericCount) {
      const count = Number(trimmedInput);
      const randomPrefix = Math.floor(100000 + Math.random() * 900000);
      for (let i = 1; i <= count; i++) {
        chatIdsToProcess.push({
          chatId: `77${randomPrefix}${String(i).padStart(3, '0')}`,
          name: `Joueur Injecté #${i}`,
          username: `player_${randomPrefix}_${i}`,
        });
      }
    } else {
      // Split by commas, semicolons, or newlines
      const rawIds = trimmedInput.split(/[\n,;\s]+/).map(s => s.trim()).filter(Boolean);
      chatIdsToProcess = rawIds.map((id, idx) => ({
        chatId: id,
        name: `Joueur #${idx + 1}`,
      }));
    }

    if (chatIdsToProcess.length === 0) {
      throw new BadRequestException('Veuillez fournir au moins un identifiant Telegram valide ou un nombre.');
    }

    let addedCount = 0;
    let skippedCount = 0;
    const targetStatus = data.status || 'APPROVED';

    for (const item of chatIdsToProcess) {
      // Check if already claimed for this promo code
      const existing = await this.prisma.playerClaim.findUnique({
        where: {
          telegramChatId_promoCodeId: {
            telegramChatId: item.chatId,
            promoCodeId: promoCode.id,
          },
        },
      });

      if (existing) {
        skippedCount++;
        continue;
      }

      const randomBookmakerId = Math.floor(1000000000 + Math.random() * 9000000000).toString();

      await this.prisma.playerClaim.create({
        data: {
          telegramChatId: item.chatId,
          telegramUsername: item.username || null,
          telegramName: item.name || `Joueur ${item.chatId.slice(-4)}`,
          promoCodeId: promoCode.id,
          orderId: order.id,
          playerBookmakerId: randomBookmakerId,
          screenshotUrl: 'manually_injected',
          status: targetStatus,
        },
      });

      addedCount++;
    }

    if (addedCount > 0) {
      await this.syncOrderStatus(order.id);
    }

    return {
      success: true,
      addedCount,
      skippedCount,
      promoCode: promoCode.code,
      bookmaker: promoCode.bookmaker,
      message: `${addedCount} consommation(s) ajoutée(s) avec succès pour le code ${promoCode.code} (${skippedCount} déjà existants).`,
    };
  }

  /**
   * Delete all claims or a specific claim for a user
   */
  async deleteUserClaims(telegramChatId: string, promoCodeId?: string) {
    const whereClause: any = { telegramChatId };
    if (promoCodeId) whereClause.promoCodeId = promoCodeId;

    const claimsToDelete = await this.prisma.playerClaim.findMany({
      where: whereClause,
      include: { order: true },
    });

    if (claimsToDelete.length === 0) {
      throw new NotFoundException('Aucune consommation trouvée pour cet utilisateur.');
    }

    const affectedOrderIds = new Set<string>();

    for (const claim of claimsToDelete) {
      if (claim.screenshotUrl) {
        this.deleteScreenshotFromDisk(claim.screenshotUrl);
      }
      if (claim.orderId) {
        affectedOrderIds.add(claim.orderId);
      }
      await this.prisma.playerClaim.delete({ where: { id: claim.id } });
    }

    for (const orderId of affectedOrderIds) {
      await this.syncOrderStatus(orderId);
    }

    // Reset conversation state
    await this.prisma.telegramConversationState.updateMany({
      where: { telegramChatId },
      data: { step: 'IDLE', currentOrderId: null, metadata: null },
    });

    return {
      success: true,
      deletedCount: claimsToDelete.length,
      message: `${claimsToDelete.length} consommation(s) supprimée(s) avec succès.`,
    };
  }
}
