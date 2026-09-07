import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
    });
  }

  // Handle Prisma unique constraint or other known DB errors
  if ((err as any).code === 'P2002') {
    return res.status(409).json({
      status: 'error',
      message: 'Un registro con este identificador único ya existe.',
    });
  }

  if ((err as any).code === 'P2025') {
    return res.status(404).json({
      status: 'error',
      message: 'El registro solicitado no fue encontrado.',
    });
  }

  console.error('Unhandled Error:', err);
  return res.status(500).json({
    status: 'error',
    message: err.message || 'Ocurrió un error interno en el servidor.',
    code: (err as any).code
  });
};
