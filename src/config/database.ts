import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

function getDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL;

  if (process.env.VERCEL) {
    const tmpDbPath = '/tmp/dev.db';
    if (!fs.existsSync(tmpDbPath)) {
      try {
        let sourcePath = path.join(process.cwd(), 'prisma', 'dev.db');
        if (!fs.existsSync(sourcePath) && envUrl && envUrl.startsWith('file:')) {
          const rawPath = envUrl.replace('file:', '').replace(/^\.\//, '');
          sourcePath = path.resolve(process.cwd(), rawPath);
        }
        if (fs.existsSync(sourcePath)) {
          fs.copyFileSync(sourcePath, tmpDbPath);
          console.log(`[Database] DB SQLite copiada a ${tmpDbPath}`);
        } else {
          console.warn(`[Database] No se encontró el archivo de base de datos en ${sourcePath}`);
        }
      } catch (err) {
        console.error('[Database] Error copiando la base de datos a /tmp:', err);
      }
    }
    return `file:${tmpDbPath}`;
  }

  if (envUrl && envUrl.startsWith('file:')) {
    return envUrl;
  }
  const dbPath = path.join(process.cwd(), 'prisma', 'dev.db').replace(/\\/g, '/');
  return `file:${dbPath}`;
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: getDatabaseUrl()
    }
  }
});

export default prisma;

