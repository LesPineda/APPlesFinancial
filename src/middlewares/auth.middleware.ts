import { Request, Response, NextFunction } from 'express';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const secretKey = process.env.API_SECRET_KEY || 'apples_fin_sec_key_2026_x89';
  const apiKeyHeader = req.headers['x-api-key'] || req.headers['authorization'];

  // Permitir la ruta de salud /health públicamente
  if (req.path === '/health') {
    return next();
  }

  // Validar cabecera de seguridad
  if (!apiKeyHeader) {
    return res.status(401).json({
      status: 'error',
      message: 'Acceso Denegado: No se proporcionó la clave de seguridad (x-api-key).'
    });
  }

  const token = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;
  const cleanedToken = token.replace(/^Bearer\s+/i, '').trim();

  if (cleanedToken !== secretKey) {
    return res.status(403).json({
      status: 'error',
      message: 'Acceso Denegado: Clave de seguridad no válida.'
    });
  }

  next();
};
