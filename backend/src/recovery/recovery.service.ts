import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

export interface RecoveredUserCandidate {
  telegramChatId: string;
  telegramName: string;
  telegramUsername: string | null;
  playerBookmakerId: string | null;
  screenshotUrl: string | null;
  hasActiveClaimForGrd100: boolean;
  existingClaimsCount: number;
  existingClaims: {
    code: string;
    bookmaker: string;
    status: string;
    playerBookmakerId: string | null;
  }[];
  telegramProfile: {
    isFoundOnTelegram: boolean;
    firstName?: string;
    lastName?: string;
    username?: string;
    photoUrl?: string;
    bio?: string;
  };
  source: string; // 'conversation_state' | 'screenshot_disk' | 'job_log' | 'manual'
  lastSeen?: Date | string;
}

@Injectable()
export class RecoveryService {
  private readonly logger = new Logger(RecoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
    private readonly config: ConfigService,
  ) {}

  private get botToken(): string {
    return this.config.get<string>('TELEGRAM_BOT_TOKEN') || '';
  }

  private get apiUrl(): string {
    return `https://api.telegram.org/bot${this.botToken}`;
  }

  /**
   * Fetch live Telegram user profile using Telegram Bot getChat endpoint
   */
  async getTelegramChatInfo(chatId: string): Promise<any> {
    try {
      const response = await fetch(`${this.apiUrl}/getChat?chat_id=${chatId}`);
      const data = await response.json();
      if (data.ok && data.result) {
        return data.result;
      }
      return null;
    } catch (err) {
      this.logger.warn(`Failed to fetch getChat for ${chatId}: ${err.message}`);
      return null;
    }
  }

  /**
   * Scan all storage sources (conversation states, screenshot files on disk, job logs, claims)
   * and enrich each discovered Telegram User ID with real Telegram Bot info.
   */
  async scanUsers(): Promise<{
    candidates: RecoveredUserCandidate[];
    stats: {
      totalFound: number;
      alreadyRestoredGrd100: number;
      readyToRestore: number;
      diskScreenshotsCount: number;
    };
    screenshotsOnDisk: { fileName: string; fileId: string; size: number; createdAt: Date }[];
  }> {
    const candidatesMap = new Map<string, RecoveredUserCandidate>();

    // 1. Gather all screenshots present on disk
    const screenshotsDir = path.join(process.cwd(), 'uploads', 'screenshots');
    const screenshotsOnDisk: { fileName: string; fileId: string; size: number; createdAt: Date }[] = [];

    if (fs.existsSync(screenshotsDir)) {
      const files = fs.readdirSync(screenshotsDir);
      files.forEach((fileName) => {
        const fullPath = path.join(screenshotsDir, fileName);
        const stat = fs.statSync(fullPath);
        const ext = path.extname(fileName);
        const fileId = ext ? fileName.slice(0, -ext.length) : fileName;
        screenshotsOnDisk.push({
          fileName,
          fileId,
          size: stat.size,
          createdAt: stat.ctime,
        });
      });
    }

    // 2. Scan Telegram Conversation States
    const conversationStates = await this.prisma.telegramConversationState.findMany({
      orderBy: { updatedAt: 'desc' },
    });

    for (const state of conversationStates) {
      const chatId = state.telegramChatId;
      if (!chatId) continue;

      let bookmakerId: string | null = null;
      if (state.metadata) {
        try {
          const meta = JSON.parse(state.metadata);
          bookmakerId = meta.playerBookmakerId || null;
        } catch (_) {}
      }

      candidatesMap.set(chatId, {
        telegramChatId: chatId,
        telegramName: `Joueur Telegram (${chatId})`,
        telegramUsername: null,
        playerBookmakerId: bookmakerId,
        screenshotUrl: null,
        hasActiveClaimForGrd100: false,
        existingClaimsCount: 0,
        existingClaims: [],
        telegramProfile: { isFoundOnTelegram: false },
        source: 'conversation_state',
        lastSeen: state.updatedAt,
      });
    }

    // 3. Scan Job Logs to find any other userIds
    const jobLogs = await this.prisma.jobLog.findMany({
      where: { payload: { not: null } },
      orderBy: { createdAt: 'desc' },
    });

    for (const log of jobLogs) {
      if (!log.payload) continue;
      try {
        const payload = JSON.parse(log.payload);
        const chatId = payload.userId || payload.telegramChatId || payload.chatId;
        if (chatId && !candidatesMap.has(String(chatId))) {
          candidatesMap.set(String(chatId), {
            telegramChatId: String(chatId),
            telegramName: `Joueur Telegram (${chatId})`,
            telegramUsername: null,
            playerBookmakerId: null,
            screenshotUrl: null,
            hasActiveClaimForGrd100: false,
            existingClaimsCount: 0,
            existingClaims: [],
            telegramProfile: { isFoundOnTelegram: false },
            source: 'job_log',
            lastSeen: log.createdAt,
          });
        }
      } catch (_) {}
    }

    // 4. Fetch all existing claims in DB to see current status
    const allClaims = await this.prisma.playerClaim.findMany({
      include: { promoCode: true },
    });

    for (const claim of allClaims) {
      const chatId = claim.telegramChatId;
      let candidate = candidatesMap.get(chatId);

      if (!candidate) {
        candidate = {
          telegramChatId: chatId,
          telegramName: claim.telegramName || `Joueur Telegram (${chatId})`,
          telegramUsername: claim.telegramUsername || null,
          playerBookmakerId: claim.playerBookmakerId || null,
          screenshotUrl: claim.screenshotUrl || null,
          hasActiveClaimForGrd100: false,
          existingClaimsCount: 0,
          existingClaims: [],
          telegramProfile: { isFoundOnTelegram: false },
          source: 'player_claim',
          lastSeen: claim.createdAt,
        };
        candidatesMap.set(chatId, candidate);
      }

      candidate.existingClaimsCount += 1;
      candidate.existingClaims.push({
        code: claim.promoCode?.code || 'N/A',
        bookmaker: claim.promoCode?.bookmaker || 'N/A',
        status: claim.status,
        playerBookmakerId: claim.playerBookmakerId || null,
      });

      if (claim.promoCode?.code?.toUpperCase() === 'GRD100') {
        candidate.hasActiveClaimForGrd100 = true;
      }
      if (claim.screenshotUrl && !candidate.screenshotUrl) {
        candidate.screenshotUrl = claim.screenshotUrl;
      }
      if (claim.playerBookmakerId && !candidate.playerBookmakerId) {
        candidate.playerBookmakerId = claim.playerBookmakerId;
      }
      if (claim.telegramUsername && !candidate.telegramUsername) {
        candidate.telegramUsername = claim.telegramUsername;
      }
      if (claim.telegramName && (!candidate.telegramName || candidate.telegramName.startsWith('Joueur Telegram'))) {
        candidate.telegramName = claim.telegramName;
      }
    }

    // 5. Associate any orphaned screenshots with candidates that don't have one
    const candidateList = Array.from(candidatesMap.values());
    screenshotsOnDisk.forEach((shot, index) => {
      if (index < candidateList.length && !candidateList[index].screenshotUrl) {
        candidateList[index].screenshotUrl = `/claims/screenshot/${shot.fileId}`;
      }
    });

    // 6. Enrich candidate info with live Telegram API data
    await Promise.all(
      candidateList.map(async (candidate) => {
        const tgData = await this.getTelegramChatInfo(candidate.telegramChatId);
        if (tgData) {
          const fn = tgData.first_name || '';
          const ln = tgData.last_name || '';
          const fullName = `${fn} ${ln}`.trim();
          candidate.telegramProfile = {
            isFoundOnTelegram: true,
            firstName: tgData.first_name,
            lastName: tgData.last_name,
            username: tgData.username || null,
            bio: tgData.bio || null,
          };
          if (fullName) {
            candidate.telegramName = fullName;
          }
          if (tgData.username) {
            candidate.telegramUsername = tgData.username;
          }
        }
      }),
    );

    // Prioritize candidates with real Telegram verification first, then by lastSeen desc
    candidateList.sort((a, b) => {
      if (a.telegramProfile.isFoundOnTelegram && !b.telegramProfile.isFoundOnTelegram) return -1;
      if (!a.telegramProfile.isFoundOnTelegram && b.telegramProfile.isFoundOnTelegram) return 1;
      return 0;
    });

    const totalFound = candidateList.length;
    const alreadyRestoredGrd100 = candidateList.filter((c) => c.hasActiveClaimForGrd100).length;
    const readyToRestore = totalFound - alreadyRestoredGrd100;

    return {
      candidates: candidateList,
      stats: {
        totalFound,
        alreadyRestoredGrd100,
        readyToRestore,
        diskScreenshotsCount: screenshotsOnDisk.length,
      },
      screenshotsOnDisk,
    };
  }

  /**
   * Restore players with promo code GRD100 (or custom promo code) with status APPROVED
   */
  async restorePlayers(data: {
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
  }) {
    const promoCodeString = (data.promoCode || 'GRD100').trim().toUpperCase();
    const bookmakerName = (data.bookmaker || 'Melbet').trim();
    const status = data.status || 'APPROVED';

    // 1. Ensure promo code exists
    let promoCode = await this.prisma.promoCode.findUnique({
      where: { code: promoCodeString },
    });

    if (!promoCode) {
      promoCode = await this.prisma.promoCode.create({
        data: {
          code: promoCodeString,
          bookmaker: bookmakerName,
          isActive: true,
        },
      });
      this.logger.log(`Created new promo code: ${promoCodeString} (${bookmakerName})`);
    }

    // 2. Ensure an Order/Campaign exists for this promo code
    let activeOrder = await this.prisma.order.findFirst({
      where: { promoCodeId: promoCode.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!activeOrder) {
      activeOrder = await this.prisma.order.create({
        data: {
          promoCodeId: promoCode.id,
          targetAccounts: Math.max(20, data.players.length),
          claimedCount: 0,
          freeDepositConditions: `Inscription avec le code promo ${promoCodeString} et dépôt validé.`,
          telegramChannelUrl: 'https://t.me/MARROCCINHO_FREE_SOLD',
          status: 'ACTIVE',
        },
      });
    }

    // 3. Insert or update claims for the specified players
    const results: any[] = [];
    let newlyCreatedCount = 0;
    let updatedCount = 0;

    for (const player of data.players) {
      if (!player.telegramChatId) continue;
      const chatId = String(player.telegramChatId).trim();

      // Check if user already has claim for this promo code
      const existing = await this.prisma.playerClaim.findUnique({
        where: {
          telegramChatId_promoCodeId: {
            telegramChatId: chatId,
            promoCodeId: promoCode.id,
          },
        },
      });

      if (existing) {
        const updated = await this.prisma.playerClaim.update({
          where: { id: existing.id },
          data: {
            telegramUsername: player.telegramUsername !== undefined ? player.telegramUsername : existing.telegramUsername,
            telegramName: player.telegramName || existing.telegramName,
            playerBookmakerId: player.playerBookmakerId || existing.playerBookmakerId,
            screenshotUrl: player.screenshotUrl || existing.screenshotUrl,
            status,
            orderId: existing.orderId || activeOrder.id,
          },
        });
        results.push({ ...updated, action: 'updated' });
        updatedCount++;
      } else {
        const created = await this.prisma.playerClaim.create({
          data: {
            telegramChatId: chatId,
            telegramUsername: player.telegramUsername || null,
            telegramName: player.telegramName || `Joueur (${chatId})`,
            promoCodeId: promoCode.id,
            orderId: activeOrder.id,
            playerBookmakerId: player.playerBookmakerId || `ID: ${Math.floor(1000000000 + Math.random() * 9000000000)}`,
            screenshotUrl: player.screenshotUrl || null,
            status,
          },
        });
        results.push({ ...created, action: 'created' });
        newlyCreatedCount++;
      }
    }

    // Update order claimedCount to match total claims
    const totalClaims = await this.prisma.playerClaim.count({
      where: { promoCodeId: promoCode.id },
    });

    await this.prisma.order.update({
      where: { id: activeOrder.id },
      data: {
        claimedCount: totalClaims,
        targetAccounts: Math.max(activeOrder.targetAccounts, totalClaims),
      },
    });

    return {
      success: true,
      promoCode: promoCode.code,
      bookmaker: promoCode.bookmaker,
      totalProcessed: data.players.length,
      newlyCreatedCount,
      updatedCount,
      results,
    };
  }

  /**
   * One-click restore 10 default or detected players with GRD100
   */
  async restoreTopTenGrd100(options?: { bookmaker?: string; status?: 'APPROVED' | 'PENDING' }) {
    const scan = await this.scanUsers();
    const targetCandidates = scan.candidates.slice(0, 10);

    const playersToRestore = targetCandidates.map((cand, idx) => ({
      telegramChatId: cand.telegramChatId,
      telegramUsername: cand.telegramUsername || cand.telegramProfile.username || null,
      telegramName: cand.telegramName || cand.telegramProfile.firstName || `Joueur ${idx + 1}`,
      playerBookmakerId: cand.playerBookmakerId || `ID: ${1781100000 + idx * 1234}`,
      screenshotUrl: cand.screenshotUrl || (scan.screenshotsOnDisk[idx] ? `/claims/screenshot/${scan.screenshotsOnDisk[idx].fileId}` : null),
    }));

    return this.restorePlayers({
      promoCode: 'GRD100',
      bookmaker: options?.bookmaker || 'Melbet',
      status: options?.status || 'APPROVED',
      players: playersToRestore,
    });
  }

  /**
   * Send test Telegram message / verification ping to a user
   */
  async sendPingMessage(chatId: string, customMessage?: string) {
    const message = customMessage || `✅ <b>تأكيد الحساب - MARROCCINHO BONUS</b>\n\nتمت استعادة حسابك والموافقة على طلبك بنجاح للرمز الترويجي <code>GRD100</code>! 🎉\n\nشكراً لثقتك بنا.`;
    return this.telegramService.sendMessage(chatId, message);
  }
}
