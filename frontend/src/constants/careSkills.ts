// 护理技能与服务类型目录（与后端 src/constants/careSkills.ts 保持一致）

export interface SkillInfo {
  value: string;
  label: string;
  professional: boolean;
}

export interface CareTypeInfo {
  value: string;
  label: string;
  color: string;
  volunteerAllowed: boolean;
}

// 志愿者可参与：陪诊、代购代办、聊天陪伴、日常陪伴
export const VOLUNTEER_ALLOWED_CARE_TYPES = [
  'accompany',
  'shopping',
  'companionship',
  'daily_companionship',
];

export const careTypes: CareTypeInfo[] = [
  { value: 'health_check', label: '健康检查', color: 'blue', volunteerAllowed: false },
  { value: 'medical_care', label: '医疗协助', color: 'red', volunteerAllowed: false },
  { value: 'accompany', label: '陪诊', color: 'green', volunteerAllowed: true },
  { value: 'daily_care', label: '日常照料', color: 'orange', volunteerAllowed: false },
  { value: 'daily_companionship', label: '日常陪伴', color: 'cyan', volunteerAllowed: true },
  { value: 'shopping', label: '代购代办', color: 'purple', volunteerAllowed: true },
  { value: 'companionship', label: '聊天陪伴', color: 'pink', volunteerAllowed: true },
  { value: 'other', label: '其他', color: 'default', volunteerAllowed: false },
];

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

export const careTypeMap = Object.fromEntries(careTypes.map((item) => [item.value, item]));

export const skillMap = Object.fromEntries(careSkills.map((item) => [item.value, item]));

// 选择服务类型时默认勾选的技能要求
export const defaultSkillsByCareType: Record<string, string[]> = {
  health_check: ['blood_pressure'],
  medical_care: ['injection', 'infusion'],
  daily_care: ['daily_care'],
  daily_companionship: ['companionship', 'walking'],
  accompany: ['accompany_visit'],
  shopping: ['shopping'],
  companionship: ['companionship'],
};

// 兼容历史中文自由文本技能（旧用户资料）
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

// 解析 users.skills / required_skills（逗号分隔文本）为标准技能编码
export function parseSkills(text?: string | null): string[] {
  if (!text) return [];
  const seen = new Set<string>();
  for (const part of text.split(/[，,、]/)) {
    const token = part.trim();
    if (!token) continue;
    const code = skillMap[token] ? token : legacySkillAliases[token];
    if (code) seen.add(code);
  }
  return [...seen];
}

export function skillLabel(value: string): string {
  return skillMap[value]?.label ?? value;
}

export function isVolunteerCareType(careType: string): boolean {
  return careTypeMap[careType]?.volunteerAllowed ?? false;
}
