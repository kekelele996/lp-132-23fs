// 护理技能目录：家属发布需求时从中选择技能要求，护工/志愿者注册时选择已掌握的技能
// professional = true 表示专业护理能力（健康检查、医疗协助类），仅专业护工可接单，志愿者不能承接
export interface SkillDef {
  code: string;
  label: string;
  professional: boolean;
}

export const SKILL_CATALOG: SkillDef[] = [
  // 专业护理技能（健康检查、医疗协助类，仅专业护工）
  { code: 'blood_pressure', label: '血压测量', professional: true },
  { code: 'blood_sugar', label: '血糖测量', professional: true },
  { code: 'injection', label: '打针', professional: true },
  { code: 'infusion', label: '输液', professional: true },
  { code: 'medication_management', label: '用药管理', professional: true },
  { code: 'wound_dressing', label: '伤口换药', professional: true },
  { code: 'catheter_care', label: '导管护理', professional: true },
  { code: 'rehabilitation', label: '康复训练', professional: true },

  // 一般生活照护技能（志愿者可参与：陪诊、聊天、代购、日常陪伴）
  { code: 'daily_care', label: '日常照料', professional: false },
  { code: 'companionship', label: '聊天陪伴', professional: false },
  { code: 'shopping', label: '代购代办', professional: false },
  { code: 'escort_outdoor', label: '陪诊陪同', professional: false },
  { code: 'meal_preparation', label: '助餐做饭', professional: false },
  { code: 'housekeeping', label: '家务整理', professional: false },
];

export const SKILL_BY_CODE = new Map(SKILL_CATALOG.map((s) => [s.code, s]));

// 旧数据里技能以中文名存储（如“血压测量、打针、输液”），这里兼容解析
const SKILL_BY_LABEL = new Map(SKILL_CATALOG.map((s) => [s.label, s.code]));

// 志愿者可参与的服务类型：陪诊、聊天、代购和日常陪伴
// 健康检查、医疗协助、日常照护等专业护理不在志愿者接单范围内
export const VOLUNTEER_ALLOWED_CARE_TYPES = ['accompany', 'shopping', 'companionship'];

/**
 * 解析技能字段为技能编码集合。
 * 兼容三种格式：
 * - 逗号/顿号分隔的技能编码（新格式）：blood_pressure,injection
 * - 逗号/顿号分隔的中文名（旧数据）：血压测量、打针
 * - 数组形式（请求体直接传数组）
 */
export const parseSkillCodes = (raw: string | string[] | null | undefined): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return Array.from(new Set(raw.map((s) => String(s).trim()).filter(Boolean)));
  }
  return Array.from(
    new Set(
      String(raw)
        .split(/[,，、;；\s]+/)
        .map((token) => token.trim())
        .filter(Boolean)
        .map((token) => SKILL_BY_LABEL.get(token) ?? token)
    )
  );
};

/** 技能编码转中文名，未知编码原样返回 */
export const skillLabel = (code: string): string => SKILL_BY_CODE.get(code)?.label ?? code;

/** 校验技能编码是否都在目录中，返回第一个非法编码，全部合法返回 null */
export const findInvalidSkill = (codes: string[]): string | null => {
  for (const code of codes) {
    if (!SKILL_BY_CODE.has(code)) return code;
  }
  return null;
};

/** 返回编码集合中属于专业护理技能的编码 */
export const filterProfessionalSkills = (codes: string[]): string[] =>
  codes.filter((code) => SKILL_BY_CODE.get(code)?.professional);
