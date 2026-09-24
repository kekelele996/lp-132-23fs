import pool from '../config/database';
import { SKILL_CATALOG } from '../constants/skills';
import { logger } from '../utils/logger';

/**
 * 轻量级启动迁移：为已有数据库补充护理技能相关结构与数据。
 * 全新数据库由 database/init.sql 直接创建，这里的语句全部幂等。
 */
export const runMigrations = async (): Promise<void> => {
  // 1. care_needs 增加 required_skills（技能要求，技能编码数组）
  const columnExists = await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_name = 'care_needs' AND column_name = 'required_skills'`
  );
  if (columnExists.rowCount === 0) {
    await pool.query(`ALTER TABLE care_needs ADD COLUMN required_skills TEXT[] NOT NULL DEFAULT '{}'`);
    logger.info('迁移完成：care_needs 增加 required_skills 列');
  }

  // 2. 技能要求 GIN 索引（支持按技能筛选）
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_care_needs_required_skills ON care_needs USING GIN (required_skills)`
  );

  // 3. 用户技能中文化旧数据 -> 技能编码（如“血压测量、打针” -> “blood_pressure,injection”）
  const labelToCode: Array<[string, string]> = SKILL_CATALOG.map((s) => [s.label, s.code]);
  const users = await pool.query(
    `SELECT id, skills FROM users
     WHERE skills IS NOT NULL AND skills <> ''
       AND skills ~ '[一-龥]'`
  );
  for (const row of users.rows) {
    const tokens = String(row.skills)
      .split(/[,，、;；\s]+/)
      .map((t: string) => t.trim())
      .filter(Boolean);
    const codes = tokens.map((token: string) => {
      const hit = labelToCode.find(([label]) => label === token);
      return hit ? hit[1] : token;
    });
    const normalized = Array.from(new Set(codes)).join(',');
    if (normalized !== row.skills) {
      await pool.query('UPDATE users SET skills = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [
        normalized,
        row.id,
      ]);
      logger.info(`迁移完成：用户 ${row.id} 技能字段标准化 (${row.skills} -> ${normalized})`);
    }
  }

  // 4. 给已有的照护需求按服务类型回填默认技能要求
  const careTypeDefaultSkill: Record<string, string> = {
    health_check: 'blood_pressure',
    medical_assist: 'medication_management',
    accompany: 'escort_outdoor',
    daily_care: 'daily_care',
    shopping: 'shopping',
    companionship: 'companionship',
  };
  const needs = await pool.query(
    `SELECT id, care_type FROM care_needs WHERE required_skills = '{}'`
  );
  for (const row of needs.rows) {
    const code = careTypeDefaultSkill[row.care_type];
    if (code) {
      await pool.query(`UPDATE care_needs SET required_skills = ARRAY[$1]::TEXT[] WHERE id = $2`, [
        code,
        row.id,
      ]);
    }
  }
  if (needs.rowCount && needs.rowCount > 0) {
    logger.info(`迁移完成：${needs.rowCount} 条照护需求已回填技能要求`);
  }
};
