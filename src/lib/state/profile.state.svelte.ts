import { persistedState } from 'svelte-persisted-state';

import {
  type ArkGridAttr,
  ArkGridAttrs,
  DEFAULT_PROFILE_NAME,
} from '../constants/enums';
import {
  type ArkGridCore,
  type ArkGridCoreType,
  ArkGridCoreTypes,
  createCore,
} from '../models/arkGridCores';
import { type ArkGridGem, determineGemGrade } from '../models/arkGridGems';
import type { SolverGemSetPackTupleSummary } from '../solver/types';
import { addNewProfile, appConfig, getProfile, initArkGridCores } from './appConfig.state.svelte';

export let currentProfileName = persistedState<string>('currentProfileName', DEFAULT_PROFILE_NAME);
export interface AllGems {
  orderGems: ArkGridGem[];
  chaosGems: ArkGridGem[];
}
export type WeaponInfo = {
  fixed: number;
  percent: number;
};
export interface CharacterProfile {
  characterName: string;
  gems: AllGems;
  cores: Record<ArkGridAttr, Record<ArkGridCoreType, ArkGridCore | null>>;
  isSupporter: boolean;
  weapon?: WeaponInfo;
  solveInfo: SolveInfo;
}

// 결과

// 준비물
export type SolveBefore = {
  coreGoalPoint: number[]; // not used
};

// 최적화 결과
export type SolveAnswerScoreSet = {
  score: number;
  bestScore: number;
  perfectScore: number;
};
export type SolveAnswer = {
  assignedGems: ArkGridGem[][];
  gemSetPackTuple: SolverGemSetPackTupleSummary;
};
export type AdditionalGemResult = Record<
  ArkGridAttr,
  Record<
    string, // 10,17,17와 같이 corePointTuple을 문자열로 만든 것
    {
      corePointTuple: [number, number, number];
      gems: ArkGridGem[];
      score: number;
    }
  >
>;
export type NeedLauncherGem = Record<ArkGridAttr, boolean>;
export type SolveAfter = {
  solveAnswer?: SolveAnswer;
  scoreSet?: SolveAnswerScoreSet;
  answerCores?: Record<ArkGridAttr, Record<ArkGridCoreType, ArkGridCore | null>>;
  additionalGemResult?: AdditionalGemResult;
  needLauncherGem?: NeedLauncherGem;
};
export type SolveInfo = {
  before: SolveBefore;
  after?: SolveAfter;
};

function stepwisePreviewCorePoint(value: unknown) {
  const point = typeof value === 'number' ? value : 0;
  if (point >= 20) return 20;
  if (point >= 19) return 19;
  if (point >= 18) return 18;
  if (point >= 17) return 17;
  if (point >= 14) return 14;
  if (point >= 10) return 10;
  return 0;
}

function sanitizeCorePointTuple(value: unknown): [number, number, number] | null {
  if (!Array.isArray(value) || value.length < 3) {
    return null;
  }

  return [
    stepwisePreviewCorePoint(value[0]),
    stepwisePreviewCorePoint(value[1]),
    stepwisePreviewCorePoint(value[2]),
  ];
}

function summarizePersistedGemSetPack(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const gemSetPack = value as {
    corePointTuple?: unknown;
    gs1?: { point?: unknown } | null;
    gs2?: { point?: unknown } | null;
    gs3?: { point?: unknown } | null;
  };
  const existingCorePointTuple = sanitizeCorePointTuple(gemSetPack.corePointTuple);

  return {
    corePointTuple: existingCorePointTuple ?? [
      stepwisePreviewCorePoint(gemSetPack.gs1?.point),
      stepwisePreviewCorePoint(gemSetPack.gs2?.point),
      stepwisePreviewCorePoint(gemSetPack.gs3?.point),
    ],
  };
}

function summarizePersistedGemSetPackTuple(value: unknown): SolverGemSetPackTupleSummary | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const gemSetPackTuple = value as {
    gsp1?: unknown;
    gsp2?: unknown;
    score?: unknown;
  };

  return {
    gsp1: summarizePersistedGemSetPack(gemSetPackTuple.gsp1),
    gsp2: summarizePersistedGemSetPack(gemSetPackTuple.gsp2),
    score: typeof gemSetPackTuple.score === 'number' ? gemSetPackTuple.score : 0,
  };
}

export function updateSolveAnswer(solveAnswer: SolveAnswer) {
  // 현재 프로필의 solve after에 solve answer 설정
  const profile = getCurrentProfile();
  if (!profile.solveInfo.after) {
    profile.solveInfo.after = {
      solveAnswer: solveAnswer,
    };
  } else {
    profile.solveInfo.after.solveAnswer = solveAnswer;
  }
}

export function updateScoreSet(scoreSet: SolveAnswerScoreSet) {
  // 현재 프로필의 solve after에 score set 설정
  const profile = getCurrentProfile();
  if (!profile.solveInfo.after) {
    profile.solveInfo.after = {
      scoreSet: scoreSet,
    };
  } else {
    profile.solveInfo.after.scoreSet = scoreSet;
  }
}

export function updateAnswerCores(
  cores: Record<ArkGridAttr, Record<ArkGridCoreType, ArkGridCore | null>>
) {
  // 현재 프로필의 solve after에 answer core 설정
  const profile = getCurrentProfile();
  if (!profile.solveInfo.after) {
    profile.solveInfo.after = {
      answerCores: cores,
    };
  } else {
    profile.solveInfo.after.answerCores = cores;
  }
}

export function updateAdditionalGemResult(additionalGemResult: AdditionalGemResult) {
  // 현재 프로필의 solve after에 additionalGemResult 설정
  const profile = getCurrentProfile();
  if (!profile.solveInfo.after) {
    profile.solveInfo.after = {
      additionalGemResult: additionalGemResult,
    };
  } else {
    profile.solveInfo.after.additionalGemResult = additionalGemResult;
  }
}

export function updateNeedLauncherGem(needLauncherGem: NeedLauncherGem) {
  // 현재 프로필의 solve after에 additionalGemResult 설정
  const profile = getCurrentProfile();
  if (!profile.solveInfo.after) {
    profile.solveInfo.after = {
      needLauncherGem: needLauncherGem,
    };
  } else {
    profile.solveInfo.after.needLauncherGem = needLauncherGem;
  }
}

export function updateSolveAfter(data: SolveAfter) {
  const profile = getCurrentProfile();
  profile.solveInfo.after = data;
}

export function initNewProfile(name: string): CharacterProfile {
  return {
    characterName: name,
    gems: {
      orderGems: [],
      chaosGems: [],
    },
    cores: initArkGridCores(),
    isSupporter: false,
    solveInfo: {
      before: {
        coreGoalPoint: [0, 0, 0, 0, 0, 0],
      },
    },
  };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sanitizeCoreRecords(value: unknown): CharacterProfile['cores'] {
  const defaultCores = initArkGridCores();
  const existingCores = isObjectRecord(value) ? value : {};

  for (const attr of Object.values(ArkGridAttrs)) {
    const existingCoresByType = isObjectRecord(existingCores[attr]) ? existingCores[attr] : {};

    for (const ctype of Object.values(ArkGridCoreTypes)) {
      const existingCore = existingCoresByType[ctype];
      if (!isObjectRecord(existingCore)) {
        continue;
      }

      defaultCores[attr][ctype] = existingCore as ArkGridCore;
      if (defaultCores[attr][ctype]?.goalPoint === undefined) {
        defaultCores[attr][ctype].goalPoint = 0;
      }
    }
  }

  return defaultCores;
}

function sanitizeSolveInfo(value: unknown): SolveInfo {
  const existingSolveInfo = isObjectRecord(value) ? value : {};
  const existingBefore = isObjectRecord(existingSolveInfo.before) ? existingSolveInfo.before : {};
  const coreGoalPoint = Array.isArray(existingBefore.coreGoalPoint)
    ? existingBefore.coreGoalPoint
    : [0, 0, 0, 0, 0, 0];

  const solveInfo: SolveInfo = {
    before: { coreGoalPoint },
  };

  if (isObjectRecord(existingSolveInfo.after)) {
    solveInfo.after = existingSolveInfo.after as SolveAfter;
  }

  return solveInfo;
}

export function migrateProfile(profile: Partial<CharacterProfile>) {
  // 업데이트로 추가되는 required 필드를 추가

  if (typeof profile.characterName !== 'string') {
    profile.characterName = DEFAULT_PROFILE_NAME;
  }

  if (!isObjectRecord(profile.gems)) {
    profile.gems = {
      orderGems: [],
      chaosGems: [],
    };
  } else {
    profile.gems.orderGems = Array.isArray(profile.gems.orderGems) ? profile.gems.orderGems : [];
    profile.gems.chaosGems = Array.isArray(profile.gems.chaosGems) ? profile.gems.chaosGems : [];
  }

  // 1. profile.isSupporter
  if (typeof profile.isSupporter !== 'boolean') {
    // console.log("isSupporter 정의 안돼있어서 추가!")
    profile.isSupporter = false;
  }
  // 2. profile.solveInfo
  profile.solveInfo = sanitizeSolveInfo(profile.solveInfo);

  const persistedGemSetPackTuple = profile.solveInfo.after?.solveAnswer?.gemSetPackTuple;
  const summarizedGemSetPackTuple = summarizePersistedGemSetPackTuple(persistedGemSetPackTuple);
  if (summarizedGemSetPackTuple && profile.solveInfo.after?.solveAnswer) {
    profile.solveInfo.after.solveAnswer.gemSetPackTuple = summarizedGemSetPackTuple;
  }

  // 3. core.goalPoint
  profile.cores = sanitizeCoreRecords(profile.cores);
}

export function getCurrentProfile() {
  // 현재 프로필을 반드시 반환합니다.
  // 프로필을 찾았다면 반환
  const profile = getProfile(currentProfileName.current);
  if (profile) return profile;
  else {
    // 기본 프로필을 찾고 있으면 변경하고 반환
    const defaultProfile = getProfile(DEFAULT_PROFILE_NAME);
    setCurrentProfileName(DEFAULT_PROFILE_NAME);
    if (defaultProfile) return defaultProfile;

    // 기본 프로필이 없다면 생성 후 반환
    const newDefaultProfile = initNewProfile(DEFAULT_PROFILE_NAME);
    if (!addNewProfile(newDefaultProfile)) {
      throw Error('기본 프로필 생성 실패!');
    }
    return newDefaultProfile;
  }
}

export function setCurrentProfileName(name: string) {
  currentProfileName.current = name;
}

export function deleteProfile(name: string) {
  if (name === DEFAULT_PROFILE_NAME) return;
  const profiles = appConfig.current.characterProfiles;
  const index = profiles.findIndex((p) => p.characterName === name);

  if (index === -1) return;
  if (currentProfileName.current === name) {
    setCurrentProfileName(profiles[index - 1].characterName);
  }
  profiles.splice(index, 1);
  // 삭제한 프로필이 현재 선택된 프로필이면 초기화
}

export function updateProfileCharacterName(name: string) {
  // 현재 프로필의 이름을 수정합니다.
  const existProfile = appConfig.current.characterProfiles.findIndex(
    (p) => p.characterName === name
  );
  if (existProfile != -1) return false;
  const profile = getCurrentProfile();
  profile.characterName = name;
}

export function addGem(gem: ArkGridGem) {
  const gems = getCurrentProfile().gems;
  const targetGems = gem.gemAttr == '질서' ? gems.orderGems : gems.chaosGems;
  gem.grade = determineGemGrade(gem.req, gem.point, gem.option1, gem.option2, gem.name);
  // validate gem (안정인데 옵션 등)
  targetGems.push(gem);
}

export function replaceGems(gemAttr: ArkGridAttr, recognizedGems: ArkGridGem[]) {
  const gems = getCurrentProfile().gems;
  const targetGems = gemAttr == '질서' ? gems.orderGems : gems.chaosGems;
  const profileGems = recognizedGems.map((recognizedGem) => {
    const profileGem = { ...recognizedGem };
    profileGem.grade = determineGemGrade(
      profileGem.req,
      profileGem.point,
      profileGem.option1,
      profileGem.option2,
      profileGem.name
    );
    return profileGem;
  });

  targetGems.splice(0, targetGems.length, ...profileGems);
}

export function clearGems(gemAttr?: ArkGridAttr) {
  const gems = getCurrentProfile().gems;
  const clearedGems =
    gemAttr === '질서'
      ? [...gems.orderGems]
      : gemAttr === '혼돈'
        ? [...gems.chaosGems]
        : [...gems.orderGems, ...gems.chaosGems];
  switch (gemAttr) {
    case '질서':
      gems.orderGems.length = 0;
      break;
    case '혼돈':
      gems.chaosGems.length = 0;
      break;
    default:
      gems.orderGems.length = 0;
      gems.chaosGems.length = 0;
  }
  window.dispatchEvent(
    new CustomEvent('arkgrid:gems-manual-change', {
      detail: { type: 'clear', gemAttr, gems: clearedGems },
    })
  );
}

export function deleteGem(gem: ArkGridGem) {
  const gems = getCurrentProfile().gems;
  const targetGems = gem.gemAttr === '질서' ? gems.orderGems : gems.chaosGems;

  // 배열에서 gem 제거
  const index = targetGems.indexOf(gem);
  if (index !== -1) {
    targetGems.splice(index, 1);
    window.dispatchEvent(
      new CustomEvent('arkgrid:gems-manual-change', {
        detail: { type: 'delete', gemAttr: gem.gemAttr, gem },
      })
    );
  }
}
export function unassignGems() {
  const gems = getCurrentProfile().gems;
  gems.orderGems.forEach((g) => {
    delete g.assign;
  });
  gems.chaosGems.forEach((g) => {
    delete g.assign;
  });
}

export function getCore(attr: ArkGridAttr, ctype: ArkGridCoreType) {
  const cores = getCurrentProfile().cores;
  return cores[attr][ctype];
}
export function addCore(attr: ArkGridAttr, ctype: ArkGridCoreType, isSupporter: boolean) {
  const profile = getCurrentProfile();
  const cores = profile.cores;
  cores[attr][ctype] = createCore(attr, ctype, '영웅', isSupporter, profile.weapon);
}
export function resetCore(attr: ArkGridAttr, ctype: ArkGridCoreType) {
  const cores = getCurrentProfile().cores;
  cores[attr][ctype] = null;
}
export function clearCores() {
  const cores = getCurrentProfile().cores;
  for (const attr of Object.values(ArkGridAttrs)) {
    for (const ctype of Object.values(ArkGridCoreTypes)) {
      cores[attr][ctype] = null;
    }
  }
}
export function updateCore(attr: ArkGridAttr, ctype: ArkGridCoreType, core: ArkGridCore) {
  const cores = getCurrentProfile().cores;
  cores[attr][ctype] = JSON.parse(JSON.stringify(core));
}

export function updateIsSupporter(v: boolean) {
  const profile = getCurrentProfile();
  profile.isSupporter = v;
}

export function updateWeapon(fixed: number, percent: number) {
  const profile = getCurrentProfile();
  profile.weapon = {
    fixed,
    percent,
  };
}

export const roleImages = import.meta.glob<string>('/src/assets/role/*.webp', {
  eager: true,
  import: 'default',
});
export const imgRoleCombat = roleImages['/src/assets/role/combat.webp'];
export const imgRoleSupporter = roleImages['/src/assets/role/supporter.webp'];
