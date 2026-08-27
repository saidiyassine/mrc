import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const bookmakers = ['Melbet', 'XParibet', '1xBet', 'Betway', 'SportyBet'];

const promoCodes = [
  { code: 'ATLASS12', bookmaker: 'Melbet' },
  { code: 'XPARI2024', bookmaker: 'XParibet' },
  { code: 'BET1X50', bookmaker: '1xBet' },
  { code: 'BWAY100', bookmaker: 'Betway' },
  { code: 'SPORTY25', bookmaker: 'SportyBet' },
  { code: 'MELWIN88', bookmaker: 'Melbet' },
  { code: 'XFREE500', bookmaker: 'XParibet' },
];

const telegramUsers = [
  { chatId: '101234567', username: 'ahmed_plays', name: 'Ahmed Benali' },
  { chatId: '102345678', username: 'sara_bet', name: 'Sara Mahmoud' },
  { chatId: '103456789', username: 'karim_wins', name: 'Karim Ouali' },
  { chatId: '104567890', username: 'nour_lucky', name: 'Nour Haddad' },
  { chatId: '105678901', username: 'youcef_g', name: 'Youcef Gharbi' },
  { chatId: '106789012', username: 'lina_jackpot', name: 'Lina Saidi' },
  { chatId: '107890123', username: 'omar_bettor', name: 'Omar Bensalem' },
  { chatId: '108901234', username: 'fatima_spin', name: 'Fatima Zohra' },
  { chatId: '109012345', username: 'amine_777', name: 'Amine Khelifi' },
  { chatId: '110123456', username: 'rania_pro', name: 'Rania Boudiaf' },
  { chatId: '111234567', username: 'ziad_bet', name: 'Ziad Merzouk' },
  { chatId: '112345678', username: 'hiba_lucky', name: 'Hiba Taleb' },
  { chatId: '113456789', username: 'bilal_wins', name: 'Bilal Cherif' },
  { chatId: '114567890', username: 'asma_slots', name: 'Asma Rahmani' },
  { chatId: '115678901', username: 'walid_pro', name: 'Walid Amrani' },
];

const claimStatuses = ['PENDING', 'APPROVED', 'REJECTED'];
const orderStatuses = ['ACTIVE', 'COMPLETED', 'PAUSED', 'PENDING'];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(daysBack: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - randomInt(0, daysBack));
  date.setHours(randomInt(0, 23), randomInt(0, 59), randomInt(0, 59));
  return date;
}

async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing data
  await prisma.jobLog.deleteMany();
  await prisma.telegramConversationState.deleteMany();
  await prisma.playerClaim.deleteMany();
  await prisma.order.deleteMany();
  await prisma.promoCode.deleteMany();
  await prisma.user.deleteMany();
  console.log('🗑️  Cleared existing data');

  // Create admin user
  await prisma.user.create({
    data: {
      email: 'admin@bot.com',
      name: 'Admin',
      password: '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36X7l6/Xe9gCMkVBgP6iZUC',
    },
  });
  console.log('👤 Created admin user (email: admin@bot.com)');

  // Create promo codes
  const createdPromoCodes = await Promise.all(
    promoCodes.map((p) =>
      prisma.promoCode.create({
        data: {
          code: p.code,
          bookmaker: p.bookmaker,
          isActive: Math.random() > 0.2,
        },
      }),
    ),
  );
  console.log(`🎟️  Created ${createdPromoCodes.length} promo codes`);

  // Create orders for each promo code
  const createdOrders: { order: any; promo: any }[] = [];
  for (const promo of createdPromoCodes) {
    const numOrders = randomInt(1, 3);
    for (let i = 0; i < numOrders; i++) {
      const targetAccounts = randomInt(10, 50);
      const order = await prisma.order.create({
        data: {
          promoCodeId: promo.id,
          targetAccounts,
          claimedCount: randomInt(0, targetAccounts),
          freeDepositConditions: `1. Join our Telegram channel\n2. Register on ${promo.bookmaker} using code ${promo.code}\n3. Make a minimum deposit of 500 DZD\n4. Submit your account ID and screenshot as proof`,
          status: randomItem(orderStatuses),
          createdAt: randomDate(60),
        },
      });
      createdOrders.push({ order, promo });
    }
  }
  console.log(`📋 Created ${createdOrders.length} orders`);

  // Create player claims
  const usedCombinations = new Set<string>();
  let claimsCreated = 0;

  for (const user of telegramUsers) {
    const numClaims = randomInt(1, 3);
    const shuffledOrders = [...createdOrders].sort(() => Math.random() - 0.5);

    for (let i = 0; i < numClaims && i < shuffledOrders.length; i++) {
      const { order, promo } = shuffledOrders[i];
      const combo = `${user.chatId}-${promo.id}`;

      if (usedCombinations.has(combo)) continue;
      usedCombinations.add(combo);

      await prisma.playerClaim.create({
        data: {
          telegramChatId: user.chatId,
          telegramUsername: user.username,
          telegramName: user.name,
          promoCodeId: promo.id,
          orderId: order.id,
          playerBookmakerId: `ID: ${randomInt(1000000, 9999999)}`,
          screenshotUrl: null,
          status: randomItem(claimStatuses),
          createdAt: randomDate(30),
        },
      });
      claimsCreated++;
    }
  }
  console.log(`🙋 Created ${claimsCreated} player claims`);

  // Create telegram conversation states
  for (const user of telegramUsers.slice(0, 5)) {
    await prisma.telegramConversationState.create({
      data: {
        telegramChatId: user.chatId,
        step: randomItem(['IDLE', 'AWAITING_PROMO_CODE', 'AWAITING_BOOKMAKER_ID', 'AWAITING_SCREENSHOT']),
        currentOrderId: randomItem(createdOrders)?.order?.id ?? null,
        metadata: JSON.stringify({ lastMessage: 'Hello!', attempts: randomInt(1, 3) }),
      },
    });
  }
  console.log('💬 Created 5 telegram conversation states');

  // Create job logs
  const jobNames = ['process-claim', 'send-notification', 'update-order-status', 'cleanup-expired'];
  const queueNames = ['claims-queue', 'notifications-queue', 'orders-queue'];
  const jobStatuses = ['SUCCESS', 'FAILED', 'PENDING'];

  for (let i = 0; i < 20; i++) {
    await prisma.jobLog.create({
      data: {
        queueName: randomItem(queueNames),
        jobName: randomItem(jobNames),
        status: randomItem(jobStatuses),
        payload: JSON.stringify({ userId: randomItem(telegramUsers).chatId, attempt: randomInt(1, 3) }),
        error: Math.random() > 0.7 ? 'Connection timeout after 5000ms' : null,
        createdAt: randomDate(7),
      },
    });
  }
  console.log('📝 Created 20 job logs');

  console.log('\n✅ Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
