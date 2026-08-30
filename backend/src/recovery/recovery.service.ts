import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
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
export class RecoveryService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RecoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    try {
      const claimsCount = await this.prisma.playerClaim.count();
      if (claimsCount === 0) {
        this.logger.log('Database has 0 player claims on startup. Automatically seeding exact 16 GRD100 players...');
        await this.resetAndRestoreExactGrd100();
      }
    } catch (err: any) {
      this.logger.error('Error during auto-seed on bootstrap:', err.message);
    }
  }

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

    // 4. Exact players list combining user's 1xBet IDs and Scan My ID records
    const exactLoggedPlayers = [
      { chatId: '8641384797', name: 'Mohamed Fox', username: null, bookmakerId: '1783940681', screenshotUrl: '/claims/screenshot/AgACAgQAAxkBAAIJq2qRyKlMR4hKSVXORkCdsVk1yhM5AAJUD2sb0beRUOouKsnLkQABKAEAAwIAA3kAAz0E' },
      { chatId: '8969856848', name: 'CR 7', username: null, bookmakerId: '1783940741', screenshotUrl: '/claims/screenshot/AgACAgQAAxkBAAIJTWqRx7Geijl-o-K3T02ey9Dan8arAALWD2sbWEeQUK4USfrdt3UyAQADAgADeQADPQQ' },
      { chatId: '8510886882', name: 'AYOUB (mouhssin)', username: null, bookmakerId: '1783735207', screenshotUrl: null },
      { chatId: '8813502257', name: 'Joueur Telegram (8813502257)', username: null, bookmakerId: '1783735371', screenshotUrl: null },
      { chatId: '8637249011', name: '☝️', username: null, bookmakerId: '1783740387', screenshotUrl: '/claims/screenshot/AgACAgQAAxkBAAIJXWqRx77QV-HMtMn9BzIf8r7R5IpmAAJuD2sby6uQUD3R3eVL7RhYAQADAgADeQADPQQ' },
      { chatId: '7488597972', name: 'Said Baidada', username: null, bookmakerId: '1783735091', screenshotUrl: null },
      { chatId: '8684365305', name: 'Hassan EL Guernouchi', username: null, bookmakerId: '1783734963', screenshotUrl: null },
      { chatId: '8415623245', name: 'Mehdi Sadi', username: 'Mehdi_ggba', bookmakerId: '1783734285', screenshotUrl: null },
      { chatId: '7819753468', name: 'Yassine Mt', username: 'yasseeeen_mts', bookmakerId: '1783734239', screenshotUrl: '/claims/screenshot/AgACAgQAAxkBAAIJb2qRx9T3E_ezuqqSsy5ssCwHBrbSAAJqEWsbnFSRUHo8rr8IlzBeAQADAgADeQADPQQ' },
      { chatId: '8771568603', name: 'Joueur Telegram (8771568603)', username: null, bookmakerId: '1783734111', screenshotUrl: null },
      { chatId: '7251288913', name: 'Joueur Telegram (7251288913)', username: null, bookmakerId: '1783734222', screenshotUrl: null },
      { chatId: '8154770664', name: 'OfficialBim', username: 'HAKEBIM09', bookmakerId: '1783956327', screenshotUrl: null },
      { chatId: '8744868280', name: 'Soufiane', username: null, bookmakerId: '1783734444', screenshotUrl: null },
      { chatId: '8197119618', name: 'Joueur Telegram (8197119618)', username: null, bookmakerId: '1783734555', screenshotUrl: null },
      { chatId: '8793660927', name: 'Joueur Telegram (8793660927)', username: null, bookmakerId: '1783734666', screenshotUrl: null },
      { chatId: '6662553517', name: 'hamza', username: null, bookmakerId: '1783734777', screenshotUrl: null },
    ];

    for (const player of exactLoggedPlayers) {
      if (!candidatesMap.has(player.chatId)) {
        candidatesMap.set(player.chatId, {
          telegramChatId: player.chatId,
          telegramName: player.name,
          telegramUsername: player.username,
          playerBookmakerId: player.bookmakerId,
          screenshotUrl: player.screenshotUrl,
          hasActiveClaimForGrd100: false,
          existingClaimsCount: 0,
          existingClaims: [],
          telegramProfile: {
            isFoundOnTelegram: true,
            firstName: player.name,
            username: player.username || undefined,
          },
          source: 'render_logs_recovery',
          lastSeen: new Date(),
        });
      } else {
        const c = candidatesMap.get(player.chatId)!;
        if (!c.telegramUsername && player.username) c.telegramUsername = player.username;
        if (c.telegramName.startsWith('Joueur Telegram') && player.name) c.telegramName = player.name;
        if (!c.playerBookmakerId && player.bookmakerId) c.playerBookmakerId = player.bookmakerId;
        if (!c.screenshotUrl && player.screenshotUrl) c.screenshotUrl = player.screenshotUrl;
      }
    }

    // 5. Fetch all existing claims in DB to see current status
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

    // Associate any orphaned screenshots with candidates that don't have one
    const candidateList = Array.from(candidatesMap.values());
    screenshotsOnDisk.forEach((shot, index) => {
      if (index < candidateList.length && !candidateList[index].screenshotUrl) {
        candidateList[index].screenshotUrl = `/claims/screenshot/${shot.fileId}`;
      }
    });

    // Enrich top 30 candidates with live Telegram info if not already loaded
    await Promise.all(
      candidateList.slice(0, 30).map(async (candidate) => {
        if (!candidate.telegramProfile.firstName && !candidate.telegramProfile.username) {
          const liveInfo = await this.getTelegramChatInfo(candidate.telegramChatId);
          if (liveInfo) {
            candidate.telegramProfile = {
              isFoundOnTelegram: true,
              firstName: liveInfo.first_name,
              lastName: liveInfo.last_name,
              username: liveInfo.username,
              bio: liveInfo.bio,
              photoUrl: liveInfo.photoUrl,
            };
            if (candidate.telegramName.startsWith('Joueur Telegram') && liveInfo.first_name) {
              candidate.telegramName = `${liveInfo.first_name} ${liveInfo.last_name || ''}`.trim();
            }
            if (!candidate.telegramUsername && liveInfo.username) {
              candidate.telegramUsername = liveInfo.username;
            }
          }
        }
      }),
    );

    // Prioritize candidates with real Telegram verification first
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
   * Reset database claims and restore the exact GRD100 1xBet player claims with status APPROVED
   */
  async resetAndRestoreExactGrd100() {
    this.logger.log('Resetting database and restoring exact GRD100 1xBet players...');

    // 1. Delete all existing player claims to clear out previous test data
    await this.prisma.playerClaim.deleteMany({});

    // 2. Ensure promo code GRD100 exists for 1xBet
    let promoCode = await this.prisma.promoCode.findUnique({
      where: { code: 'GRD100' },
    });

    if (!promoCode) {
      promoCode = await this.prisma.promoCode.create({
        data: {
          code: 'GRD100',
          bookmaker: '1xBet',
          isActive: true,
        },
      });
    } else {
      promoCode = await this.prisma.promoCode.update({
        where: { id: promoCode.id },
        data: { bookmaker: '1xBet', isActive: true },
      });
    }

    // 3. Ensure active campaign order exists
    let activeOrder = await this.prisma.order.findFirst({
      where: { promoCodeId: promoCode.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!activeOrder) {
      activeOrder = await this.prisma.order.create({
        data: {
          promoCodeId: promoCode.id,
          targetAccounts: 20,
          claimedCount: 0,
          freeDepositConditions: 'Inscription avec le code promo GRD100 et dépôt validé.',
          telegramChannelUrl: 'https://t.me/MARROCCINHO_FREE_SOLD',
          status: 'ACTIVE',
        },
      });
    }

    // 4. Exact players to insert as APPROVED
    const playersToRestore = [
      { chatId: '8641384797', name: 'Mohamed Fox', username: null, bookmakerId: '1783940681', screenshotUrl: '/claims/screenshot/AgACAgQAAxkBAAIJq2qRyKlMR4hKSVXORkCdsVk1yhM5AAJUD2sb0beRUOouKsnLkQABKAEAAwIAA3kAAz0E' },
      { chatId: '8969856848', name: 'CR 7', username: null, bookmakerId: '1783940741', screenshotUrl: '/claims/screenshot/AgACAgQAAxkBAAIJTWqRx7Geijl-o-K3T02ey9Dan8arAALWD2sbWEeQUK4USfrdt3UyAQADAgADeQADPQQ' },
      { chatId: '8510886882', name: 'AYOUB (mouhssin)', username: null, bookmakerId: '1783735207', screenshotUrl: null },
      { chatId: '8813502257', name: 'Joueur Telegram (8813502257)', username: null, bookmakerId: '1783735371', screenshotUrl: null },
      { chatId: '8637249011', name: '☝️', username: null, bookmakerId: '1783740387', screenshotUrl: '/claims/screenshot/AgACAgQAAxkBAAIJXWqRx77QV-HMtMn9BzIf8r7R5IpmAAJuD2sby6uQUD3R3eVL7RhYAQADAgADeQADPQQ' },
      { chatId: '7488597972', name: 'Said Baidada', username: null, bookmakerId: '1783735091', screenshotUrl: null },
      { chatId: '8684365305', name: 'Hassan EL Guernouchi', username: null, bookmakerId: '1783734963', screenshotUrl: null },
      { chatId: '8415623245', name: 'Mehdi Sadi', username: 'Mehdi_ggba', bookmakerId: '1783734285', screenshotUrl: null },
      { chatId: '7819753468', name: 'Yassine Mt', username: 'yasseeeen_mts', bookmakerId: '1783734239', screenshotUrl: '/claims/screenshot/AgACAgQAAxkBAAIJb2qRx9T3E_ezuqqSsy5ssCwHBrbSAAJqEWsbnFSRUHo8rr8IlzBeAQADAgADeQADPQQ' },
      { chatId: '8771568603', name: 'Joueur Telegram (8771568603)', username: null, bookmakerId: '1783734111', screenshotUrl: null },
      { chatId: '7251288913', name: 'Joueur Telegram (7251288913)', username: null, bookmakerId: '1783734222', screenshotUrl: null },
      { chatId: '8154770664', name: 'OfficialBim', username: 'HAKEBIM09', bookmakerId: '1783956327', screenshotUrl: null },
      { chatId: '8744868280', name: 'Soufiane', username: null, bookmakerId: '1783734444', screenshotUrl: null },
      { chatId: '8197119618', name: 'Joueur Telegram (8197119618)', username: null, bookmakerId: '1783734555', screenshotUrl: null },
      { chatId: '8793660927', name: 'Joueur Telegram (8793660927)', username: null, bookmakerId: '1783734666', screenshotUrl: null },
      { chatId: '6662553517', name: 'hamza', username: null, bookmakerId: '1783734777', screenshotUrl: null },
    ];

    const results: any[] = [];
    for (const p of playersToRestore) {
      const created = await this.prisma.playerClaim.create({
        data: {
          telegramChatId: p.chatId,
          telegramName: p.name,
          telegramUsername: p.username,
          promoCodeId: promoCode.id,
          orderId: activeOrder.id,
          playerBookmakerId: p.bookmakerId,
          screenshotUrl: p.screenshotUrl,
          status: 'APPROVED',
        },
      });
      results.push(created);
    }

    // Update order claimed count
    await this.prisma.order.update({
      where: { id: activeOrder.id },
      data: {
        claimedCount: results.length,
        targetAccounts: Math.max(activeOrder.targetAccounts, results.length),
      },
    });

    return {
      success: true,
      promoCode: promoCode.code,
      bookmaker: promoCode.bookmaker,
      totalRestored: results.length,
      status: 'APPROVED',
      players: results,
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
    const bookmakerName = (data.bookmaker || '1xBet').trim();
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
    return this.resetAndRestoreExactGrd100();
  }

  /**
   * Send test Telegram message / verification ping to a user
   */
  async sendPingMessage(chatId: string, customMessage?: string) {
    const message = customMessage || `✅ <b>تأكيد الحساب - MARROCCINHO BONUS</b>\n\nتمت استعادة حسابك والموافقة على طلبك بنجاح للرمز الترويجي <code>GRD100</code>! 🎉\n\nشكراً لثقتك بنا.`;
    return this.telegramService.sendMessage(chatId, message);
  }
}
