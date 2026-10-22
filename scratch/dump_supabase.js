const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function dump() {
  const accounts = await prisma.account.findMany({ orderBy: { nombre: 'asc' } });
  const debts = await prisma.debt.findMany({ include: { cuenta: true }, orderBy: { createdAt: 'asc' } });
  const transactions = await prisma.transaction.findMany({ include: { cuenta: true }, orderBy: { fecha_transaccion: 'desc' } });

  const data = {
    accounts,
    debts,
    transactions,
    exportedAt: new Date().toISOString()
  };

  const outFile = path.join(__dirname, 'supabase_data.json');
  fs.writeFileSync(outFile, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Exported Supabase data to ${outFile}:`);
  console.log(`- Accounts: ${accounts.length}`);
  console.log(`- Debts: ${debts.length}`);
  console.log(`- Transactions: ${transactions.length}`);
}

dump()
  .catch(err => {
    console.error('Error dumping Supabase:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
