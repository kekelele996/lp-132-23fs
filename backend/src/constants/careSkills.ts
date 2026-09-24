// 护理技能与服务类型目录
//
// 家属发布照护需求时从此目录中勾选「技能要求」，护工/志愿者用个人资料里
// 已具备的技能去接单。志愿者只能参与陪诊、代购、聊天、日常陪伴这类
// 非专业护理，专业护理技能（professional = true）仅护工可持有。

export interface SkillInfo {
  value: string;
  label: string;
  professional: boolean;
}

export interface CareTypeInfo {
  value: string;
  label: string;
  // 志愿者是否可以接该服务类型
  volunteerAllowed: boolean;
}

// 专业护理服务类型：志愿者不可接单
export const PROFESSIONAL_CARE_TYPES = ['health_check', 'medical_care'];

// 志愿者可参与的服务类型：陪诊、代购代办、聊天陪伴、日常陪伴
export const VOLUNTEER_ALLOWED_CARE_TYPES = [
  'accompany',
  'shopping',
  'companionship',
  'daily_companionship',
];

export const careTypes: CareTypeInfo[] = [
  { value: 'health_check', label: '健康检查', volunteerAllowed: false },
  { value: 'medical_care', label: '医疗协助', volunteerAllowed: false },
  { value: 'accompany', label: '陪诊', volunteerAllowed: true },
  { value: 'daily_care', label: '日常照料', volunteerAllowed: false },
  { value: 'daily_companionship', label: '日常陪伴', volunteerAllowed: true },
  { value: 'shopping', label: '代购代办', volunteerAllowed: true },
  { value: 'companionship', label: '聊天陪伴', volunteerAllowed: true },
  { value: 'other', label: '其他', volunteerAllowed: false },
];

// 护理技能目录（家属发布需求时勾选，护工资料中维护）
export const careSkills: SkillInfo[] = [
  { value: 'blood_pressure', label: '血压测量', professional: true },
  { value: 'blood_glucose', label: '血糖测量', professional: true },
  { value: 'injection', label: '注射打针', professional: true },
  { value: 'infusion', label: '输液护理', professional: true },
  { value: 'wound_care', label: '伤口换药', professional: true },
  { value: 'medication_management', label: '用药管理', professional: true },
  { value: 'rehabilitation', label: '康复训练', professional: true },
  { value: 'daily_care', label: '日常照料', professional: false },
  { value: 'accompany_visit', label: '陪诊', professional: false },
  { value: 'shopping', label: '代购代办', professional: false },
  { value: 'companionship', label: '聊天陪伴', professional: false },
  { value: 'walking', label: '陪同散步', professional: false },
];

export const careTypeMap: Record<string, CareTypeInfo> = Object.fromEntries(
  careTypes.map((item) => [item.value, item])
);

export const skillMap: Record<string, SkillInfo> = Object.fromEntries(
  careSkills.map((item) => [item.value, item])
);

export const professionalSkillSet = new Set(
  careSkills.filter((item) => item.professional).map((item) => item.value)
);

// 选择服务类型时默认建议的技能要求
export const defaultSkillsByCareType: Record<string, string[]> = {
  health_check: ['blood_pressure'],
  medical_care: ['injection', 'infusion'],
  daily_care: ['daily_care'],
  daily_companionship: ['companionship', 'walking'],
  accompany: ['accompany_visit'],
  shopping: ['shopping'],
  companionship: ['companionship'],
};

// 把接口传入的技能值归一化为去重后的合法技能编码数组
export function normalizeSkills(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  for (const raw of input) {
    const value = String(raw ?? '').trim();
    if (value && skillMap[value] && !seen.has(value)) {
      seen.add(value);
    }
  }
  return [...seen];
}

// 兼容技能以数组或「血压测量、打针」式逗号分隔文本传入
export function normalizeSkillInput(input: unknown): string[] {
  if (Array.isArray(input)) return normalizeSkills(input);
  if (typeof input === 'string') return parseSkillText(input);
  return [];
}

// 历史数据中以中文自由文本保存的技能 -> 标准编码
const legacySkillAliases: Record<string, string> = {
  血压测量: 'blood_pressure',
  量血压: 'blood_pressure',
  血糖测量: 'blood_glucose',
  量血糖: 'blood_glucose',
  打针: 'injection',
  注射: 'injection',
  输液: 'infusion',
  换药: 'wound_care',
  伤口换药: 'wound_care',
  康复训练: 'rehabilitation',
  康复: 'rehabilitation',
  用药管理: 'medication_management',
  日常照料: 'daily_care',
  陪诊: 'accompany_visit',
  陪同就医: 'accompany_visit',
  代购: 'shopping',
  代购代办: 'shopping',
  聊天陪伴: 'companionship',
  聊天: 'companionship',
  陪同散步: 'walking',
  散步: 'walking',
};

// users.skills 在库中以逗号分隔文本保存，统一读写
export function parseSkillText(text: string | null | undefined): string[] {
  if (!text) return [];
  const seen = new Set<string>();
  for (const part of text.split(/[，,、]/)) {
    const token = part.trim();
    if (!token) continue;
    const code = skillMap[token] ? token : legacySkillAliases[token];
    if (code && skillMap[code]) seen.add(code);
  }
  return [...seen];
}

export function formatSkillText(skills: string[]): string {
  return skills.filter((item) => skillMap[item]).join(',');
}

export function skillLabel(value: string): string {
  return skillMap[value]?.label ?? value;
}

export function isVolunteerCareType(careType: string): boolean {
  return careTypeMap[careType]?.volunteerAllowed ?? false;
}
