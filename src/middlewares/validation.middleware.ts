import { Request, Response, NextFunction } from 'express';
import { AppError } from './error.middleware';

export const validateBody = (requiredFields: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const missingFields = requiredFields.filter(
      (field) => req.body[field] === undefined || req.body[field] === null || req.body[field] === ''
    );
    
    if (missingFields.length > 0) {
      return next(new AppError(400, `Campos requeridos faltantes: ${missingFields.join(', ')}`));
    }
    next();
  };
};
