import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const exact16Players = [
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

async function main() {
  console.log('🌱 Seeding database with exact 16 players for 1xBet GRD100...');

  // Create or update promo code GRD100
  let promoCode = await prisma.promoCode.findUnique({
    where: { code: 'GRD100' },
  });

  if (!promoCode) {
    promoCode = await prisma.promoCode.create({
      data: {
        code: 'GRD100',
        bookmaker: '1xBet',
        isActive: true,
      },
    });
  }

  // Create or update order
  let order = await prisma.order.findFirst({
    where: { promoCodeId: promoCode.id },
  });

  if (!order) {
    order = await prisma.order.create({
      data: {
        promoCodeId: promoCode.id,
        targetAccounts: 20,
        claimedCount: exact16Players.length,
        freeDepositConditions: 'Inscription avec le code promo GRD100 sur 1xBet et dépôt validé.',
        telegramChannelUrl: 'https://t.me/MARROCCINHO_FREE_SOLD',
        status: 'ACTIVE',
      },
    });
  }

  for (const p of exact16Players) {
    await prisma.playerClaim.upsert({
      where: {
        telegramChatId_promoCodeId: {
          telegramChatId: p.chatId,
          promoCodeId: promoCode.id,
        },
      },
      update: {
        telegramName: p.name,
        telegramUsername: p.username,
        playerBookmakerId: p.bookmakerId,
        screenshotUrl: p.screenshotUrl,
        status: 'APPROVED',
        orderId: order.id,
      },
      create: {
        telegramChatId: p.chatId,
        telegramName: p.name,
        telegramUsername: p.username,
        promoCodeId: promoCode.id,
        orderId: order.id,
        playerBookmakerId: p.bookmakerId,
        screenshotUrl: p.screenshotUrl,
        status: 'APPROVED',
      },
    });
  }

  console.log(`✅ Seeded ${exact16Players.length} exact 1xBet GRD100 players with status APPROVED!`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
