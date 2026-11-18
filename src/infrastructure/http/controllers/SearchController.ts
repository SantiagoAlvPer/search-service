import { NextFunction, Request, Response, Router } from 'express';
import { SearchUsersUseCase } from '../../../application/use-cases/SearchUsersUseCase.js';

export function createSearchRouter(searchUsersUseCase: SearchUsersUseCase): Router {
  const router = Router();

  router.get(
    '/search/users',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const q = typeof req.query.q === 'string' ? req.query.q : undefined;
        const status =
          typeof req.query.status === 'string' ? req.query.status : undefined;
        const limit = req.query.limit ? Number(req.query.limit) : undefined;
        const offset = req.query.offset ? Number(req.query.offset) : undefined;

        const result = await searchUsersUseCase.execute({
          q,
          status,
          limit: Number.isFinite(limit) ? limit : undefined,
          offset: Number.isFinite(offset) ? offset : undefined,
        });

        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
