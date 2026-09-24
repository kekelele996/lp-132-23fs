import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { SKILL_CATALOG, VOLUNTEER_ALLOWED_CARE_TYPES } from '../constants/skills';

const router = Router();

// 护理技能目录：家属发布需求时选择技能要求，护工/志愿者维护个人技能时使用
router.get('/catalog', authenticate, (_req: AuthRequest, res: Response) => {
  res.json({
    skills: SKILL_CATALOG,
    volunteer_allowed_care_types: VOLUNTEER_ALLOWED_CARE_TYPES,
  });
});

export default router;
