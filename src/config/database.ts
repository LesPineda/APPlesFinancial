import { PrismaClient } from '@prisma/client';

let dbUrl = process.env.DATABASE_URL || '';
if (dbUrl && !dbUrl.includes('pgbouncer=true')) {
  dbUrl += dbUrl.includes('?') ? '&pgbouncer=true' : '?pgbouncer=true';
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl
    }
  }
});

export default prisma;
