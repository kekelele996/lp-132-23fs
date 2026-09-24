import { Router, Response } from 'express';
import pool from '../config/database';
import { sendServerError } from '../utils/httpResponses';
import { AuthRequest, authenticate, requireRole } from '../middleware/auth';
import {
  VOLUNTEER_ALLOWED_CARE_TYPES,
  parseSkillCodes,
  skillLabel,
  findInvalidSkill,
  filterProfessionalSkills,
} from '../constants/skills';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { status, care_type, page = 1, limit = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `SELECT cn.*, e.name as elderly_name, e.gender as elderly_gender, e.age as elderly_age, u.real_name as child_name, u.phone as child_phone, w.real_name as worker_name FROM care_needs cn LEFT JOIN elderly_profiles e ON cn.elderly_id = e.id LEFT JOIN users u ON cn.child_id = u.id LEFT JOIN users w ON cn.worker_id = w.id`;
    const conditions: string[] = [];
    const params: any[] = [];

    if (status) {
      conditions.push(`cn.status = $${params.length + 1}`);
      params.push(status);
    }

    if (care_type) {
      conditions.push(`cn.care_type = $${params.length + 1}`);
      params.push(care_type);
    }

    if (req.user?.role === 'child') {
      conditions.push(`cn.child_id = $${params.length + 1}`);
      params.push(req.user.id);
    } else if (req.user?.role === 'worker' || req.user?.role === 'volunteer') {
      conditions.push(`(cn.status = 'pending' OR cn.worker_id = $${params.length + 1})`);
      params.push(req.user.id);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY cn.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(Number(limit), offset);

    const result = await pool.query(query, params);

    let countQuery = 'SELECT COUNT(*) FROM care_needs cn';
    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }
    const countResult = await pool.query(countQuery, params.slice(0, -2));

    res.json({
      needs: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: Number(page),
      limit: Number(limit)
    });
  } catch (error) {
    sendServerError(res, error);
  }
});

router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT cn.*, e.name as elderly_name, e.gender as elderly_gender, e.age as elderly_age,
              e.medical_history, e.medication, e.address as elderly_address,
              e.emergency_contact, e.emergency_phone,
              u.real_name as child_name, u.phone as child_phone,
              w.real_name as worker_name, w.phone as worker_phone,
              w.skills as worker_skills
       FROM care_needs cn
       LEFT JOIN elderly_profiles e ON cn.elderly_id = e.id
       LEFT JOIN users u ON cn.child_id = u.id
       LEFT JOIN users w ON cn.worker_id = w.id
       WHERE cn.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: '需求不存在' });
    }

    const need = result.rows[0];

    if (req.user?.role === 'child' && need.child_id !== req.user?.id) {
      return res.status(403).json({ message: '无权限查看' });
    }

    if ((req.user?.role === 'worker' || req.user?.role === 'volunteer') && need.status === 'pending' && need.child_id !== req.user?.id) {
    } else if ((req.user?.role === 'worker' || req.user?.role === 'volunteer') && need.worker_id !== req.user?.id) {
      return res.status(403).json({ message: '无权限查看' });
    }

    res.json(need);
  } catch (error) {
    sendServerError(res, error);
  }
});

router.post('/', authenticate, requireRole('child'), async (req: AuthRequest, res: Response) => {
  try {
    const { elderly_id, title, description, care_type, start_time, end_time, address, duration_hours, price } = req.body;
    const required_skills = parseSkillCodes(req.body.required_skills);

    if (!elderly_id || !title || !description || !care_type || !start_time || !address) {
      return res.status(400).json({ message: '请填写必要信息' });
    }

    if (required_skills.length === 0) {
      return res.status(400).json({ message: '请从护理技能中选择本需求要求的能力' });
    }

    const invalidSkill = findInvalidSkill(required_skills);
    if (invalidSkill) {
      return res.status(400).json({ message: `存在未知的护理技能：${invalidSkill}` });
    }

    const elderlyCheck = await pool.query(
      'SELECT id FROM elderly_profiles WHERE id = $1 AND child_id = $2',
      [elderly_id, req.user?.id]
    );

    if (elderlyCheck.rows.length === 0) {
      return res.status(404).json({ message: '老人档案不存在或无权限' });
    }

    const result = await pool.query(
      `INSERT INTO care_needs (child_id, elderly_id, title, description, care_type, required_skills, start_time, end_time, address, duration_hours, price)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [req.user?.id, elderly_id, title, description, care_type, required_skills, start_time, end_time, address, duration_hours, price]
    );

    res.status(201).json({ message: '发布成功', need: result.rows[0] });
  } catch (error) {
    sendServerError(res, error);
  }
});

router.post('/:id/accept', authenticate, requireRole('worker', 'volunteer'), async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    // 全程在一个事务里：行锁先锁定需求 -> 校验状态/角色/技能 -> 全部通过才更新为已接单，
    // 避免“先占单再因资格不符退回”，也避免两人同时接单。
    await client.query('BEGIN');

    const lockResult = await client.query(
      `SELECT cn.status, cn.care_type, cn.required_skills, u.role as worker_role, u.skills as worker_skills
       FROM care_needs cn
       JOIN users u ON u.id = $2
       WHERE cn.id = $1
       FOR UPDATE OF cn`,
      [req.params.id, req.user?.id]
    );

    if (lockResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: '需求不存在' });
    }

    const need = lockResult.rows[0];

    if (need.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: '该需求已被接单' });
    }

    const requiredSkills: string[] = need.required_skills || [];

    // 志愿者只参与陪诊、聊天、代购和日常陪伴，不接健康检查、医疗协助等专业护理
    if (need.worker_role === 'volunteer') {
      const professionalRequired = filterProfessionalSkills(requiredSkills);
      if (!VOLUNTEER_ALLOWED_CARE_TYPES.includes(need.care_type) || professionalRequired.length > 0) {
        await client.query('ROLLBACK');
        return res.status(403).json({
          message: '该需求包含健康检查、医疗协助等专业护理内容，志愿者不能接单；志愿者可承接陪诊、聊天、代购和日常陪伴类需求',
          code: 'PROFESSIONAL_CARE_NOT_ALLOWED',
          professional_skills: professionalRequired.map((code) => ({ code, label: skillLabel(code) })),
        });
      }
    }

    // 核对技能是否齐备，明确返回缺少的每一项能力
    const ownedSkills = new Set(parseSkillCodes(need.worker_skills));
    const missingSkills = requiredSkills.filter((code) => !ownedSkills.has(code));

    if (missingSkills.length > 0) {
      await client.query('ROLLBACK');
      const missingLabels = missingSkills.map(skillLabel);
      return res.status(403).json({
        message: `接单失败：您缺少本需求要求的护理技能「${missingLabels.join('、')}」`,
        code: 'SKILL_NOT_MATCH',
        missing_skills: missingSkills.map((code) => ({ code, label: skillLabel(code) })),
      });
    }

    const result = await client.query(
      'UPDATE care_needs SET status = $1, worker_id = $2, accepted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      ['accepted', req.user?.id, req.params.id]
    );

    await client.query('COMMIT');

    res.json({ message: '接单成功', need: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    sendServerError(res, error);
  } finally {
    client.release();
  }
});

router.post('/:id/start', authenticate, requireRole('worker', 'volunteer'), async (req: AuthRequest, res: Response) => {
  try {
    const checkResult = await pool.query(
      'SELECT status, worker_id FROM care_needs WHERE id = $1',
      [req.params.id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: '需求不存在' });
    }

    if (checkResult.rows[0].worker_id !== req.user?.id) {
      return res.status(403).json({ message: '无权限操作' });
    }

    if (checkResult.rows[0].status !== 'accepted') {
      return res.status(400).json({ message: '状态不正确' });
    }

    const result = await pool.query(
      'UPDATE care_needs SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      ['in_progress', req.params.id]
    );

    res.json({ message: '服务已开始', need: result.rows[0] });
  } catch (error) {
    sendServerError(res, error);
  }
});

router.post('/:id/complete', authenticate, requireRole('worker', 'volunteer'), async (req: AuthRequest, res: Response) => {
  try {
    const checkResult = await pool.query(
      'SELECT status, worker_id, price FROM care_needs WHERE id = $1',
      [req.params.id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: '需求不存在' });
    }

    if (checkResult.rows[0].worker_id !== req.user?.id) {
      return res.status(403).json({ message: '无权限操作' });
    }

    if (checkResult.rows[0].status !== 'in_progress') {
      return res.status(400).json({ message: '状态不正确' });
    }

    const result = await pool.query(
      'UPDATE care_needs SET status = $1, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      ['completed', req.params.id]
    );

    await pool.query(
      'UPDATE users SET order_count = order_count + 1, total_income = total_income + $1 WHERE id = $2',
      [checkResult.rows[0].price || 0, req.user?.id]
    );

    res.json({ message: '服务已完成', need: result.rows[0] });
  } catch (error) {
    sendServerError(res, error);
  }
});

router.post('/:id/cancel', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const checkResult = await pool.query(
      'SELECT status, child_id, worker_id FROM care_needs WHERE id = $1',
      [req.params.id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: '需求不存在' });
    }

    if (req.user?.role === 'child' && checkResult.rows[0].child_id !== req.user?.id) {
      return res.status(403).json({ message: '无权限操作' });
    }

    if ((req.user?.role === 'worker' || req.user?.role === 'volunteer') && checkResult.rows[0].worker_id !== req.user?.id) {
      return res.status(403).json({ message: '无权限操作' });
    }

    if (!['pending', 'accepted'].includes(checkResult.rows[0].status)) {
      return res.status(400).json({ message: '无法取消该订单' });
    }

    const result = await pool.query(
      'UPDATE care_needs SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      ['cancelled', req.params.id]
    );

    res.json({ message: '已取消', need: result.rows[0] });
  } catch (error) {
    sendServerError(res, error);
  }
});

export default router;
