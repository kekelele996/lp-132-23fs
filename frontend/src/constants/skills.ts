// 护理技能目录（与后端 constants/skills.ts 保持一致）
// professional = true 为专业护理技能（健康检查、医疗协助类），仅专业护工可接单
export interface SkillDef {
  code: string;
  label: string;
  professional: boolean;
}

export const SKILL_CATALOG: SkillDef[] = [
  // 专业护理技能
  { code: 'blood_pressure', label: '血压测量', professional: true },
  { code: 'blood_sugar', label: '血糖测量', professional: true },
  { code: 'injection', label: '打针', professional: true },
  { code: 'infusion', label: '输液', professional: true },
  { code: 'medication_management', label: '用药管理', professional: true },
  { code: 'wound_dressing', label: '伤口换药', professional: true },
  { code: 'catheter_care', label: '导管护理', professional: true },
  { code: 'rehabilitation', label: '康复训练', professional: true },
  // 一般生活照护技能（志愿者可参与）
  { code: 'daily_care', label: '日常照料', professional: false },
  { code: 'companionship', label: '聊天陪伴', professional: false },
  { code: 'shopping', label: '代购代办', professional: false },
  { code: 'escort_outdoor', label: '陪诊陪同', professional: false },
  { code: 'meal_preparation', label: '助餐做饭', professional: false },
  { code: 'housekeeping', label: '家务整理', professional: false },
];

export const PROFESSIONAL_SKILLS = SKILL_CATALOG.filter((s) => s.professional);
export const GENERAL_SKILLS = SKILL_CATALOG.filter((s) => !s.professional);

const SKILL_BY_CODE = new Map(SKILL_CATALOG.map((s) => [s.code, s]));
const SKILL_BY_LABEL = new Map(SKILL_CATALOG.map((s) => [s.label, s.code]));

export const skillLabel = (code: string): string => SKILL_BY_CODE.get(code)?.label ?? code;

export const isProfessionalSkill = (code: string): boolean =>
  !!SKILL_BY_CODE.get(code)?.professional;

/** 解析用户资料中的技能字段（编码/中文名混合、逗号/顿号分隔）为编码数组 */
export const parseSkillCodes = (raw?: string | string[] | null): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return raw
    .split(/[,，、;；\s]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((token) => SKILL_BY_LABEL.get(token) ?? token);
};
