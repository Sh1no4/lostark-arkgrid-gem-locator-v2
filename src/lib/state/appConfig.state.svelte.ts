import { persistedState } from 'svelte-persisted-state';

import { type ArkGridAttr, ArkGridAttrs, DEFAULT_PROFILE_NAME } from '../constants/enums';
import { type ArkGridCore, type ArkGridCoreType, ArkGridCoreTypes } from '../models/arkGridCores';
import { type CharacterProfile, initNewProfile, migrateProfile } from './profile.state.svelte';

interface UIConfig {
  showGemRecognitionPanel: boolean;
  showGemRecognitionGuide: boolean;
  showCoreCoeff: boolean;
  debugMode: boolean;
  darkMode: boolean;
  deferredScreenSharingInit: boolean;
  newGemAddStyle: boolean;
}
const defaultUIConfig: UIConfig = {
  showGemRecognitionPanel: true,
  showGemRecognitionGuide: true,
  showCoreCoeff: false,
  debugMode: false,
  darkMode: false,
  deferredScreenSharingInit: false,
  newGemAddStyle: false,
};

interface AppConfig {
  characterProfiles: CharacterProfile[];
  uiConfig: UIConfig;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readBooleanOrDefault(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function createDefaultAppConfig(): AppConfig {
  return {
    characterProfiles: [initNewProfile(DEFAULT_PROFILE_NAME)],
    uiConfig: { ...defaultUIConfig },
  };
}

function sanitizeUIConfig(value: unknown): UIConfig {
  const existingUIConfig = isObjectRecord(value) ? value : {};

  return {
    showGemRecognitionPanel: readBooleanOrDefault(
      existingUIConfig.showGemRecognitionPanel,
      defaultUIConfig.showGemRecognitionPanel
    ),
    showGemRecognitionGuide: readBooleanOrDefault(
      existingUIConfig.showGemRecognitionGuide,
      defaultUIConfig.showGemRecognitionGuide
    ),
    showCoreCoeff: readBooleanOrDefault(
      existingUIConfig.showCoreCoeff,
      defaultUIConfig.showCoreCoeff
    ),
    debugMode: readBooleanOrDefault(existingUIConfig.debugMode, defaultUIConfig.debugMode),
    darkMode: readBooleanOrDefault(existingUIConfig.darkMode, defaultUIConfig.darkMode),
    deferredScreenSharingInit: readBooleanOrDefault(
      existingUIConfig.deferredScreenSharingInit,
      defaultUIConfig.deferredScreenSharingInit
    ),
    newGemAddStyle: readBooleanOrDefault(
      existingUIConfig.newGemAddStyle,
      defaultUIConfig.newGemAddStyle
    ),
  };
}

function sanitizeCharacterProfiles(value: unknown): CharacterProfile[] {
  if (!Array.isArray(value)) {
    return [initNewProfile(DEFAULT_PROFILE_NAME)];
  }

  const migratedProfiles = value
    .filter(isObjectRecord)
    .map((profile) => {
      migrateProfile(profile);
      return profile as CharacterProfile;
    });

  return migratedProfiles.length > 0 ? migratedProfiles : [initNewProfile(DEFAULT_PROFILE_NAME)];
}

// serializer object for svelte-persisted-state
export const bigIntSerializer = {
  // bigInt의 경우 string으로 바꾼 뒤 가장 끝에 n을 붙여서 직렬화
  stringify: (value: any) => {
    return JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? v.toString() + 'n' : v));
  },

  // string이고 n으로 끝나는 정수라면, BigInt화
  parse: (text: string) => {
    return JSON.parse(text, (_, v) => {
      if (typeof v === 'string' && /^\d+n$/.test(v)) {
        return BigInt(v.slice(0, -1));
      }
      return v;
    });
  },
};
export function migrateAppConfig(value: unknown): AppConfig {
  if (!isObjectRecord(value)) {
    return createDefaultAppConfig();
  }

  const appConfig = value as Partial<AppConfig> & Record<string, unknown>;
  appConfig.uiConfig = sanitizeUIConfig(appConfig.uiConfig);
  appConfig.characterProfiles = sanitizeCharacterProfiles(appConfig.characterProfiles);

  // appLocale 제거
  if ('appLocale' in appConfig) {
    delete appConfig.appLocale;
  }
  // Korean OpenAPI import support was removed in this fork.
  if ('openApiConfig' in appConfig) {
    delete appConfig.openApiConfig;
  }

  return appConfig as AppConfig;
}

export const appConfig = persistedState<AppConfig>(
  'appConfig',
  createDefaultAppConfig(),
  {
    serializer: bigIntSerializer,
    beforeRead: (value) => {
      return migrateAppConfig(value);
    },
  }
);

export function initArkGridCores(): Record<
  ArkGridAttr,
  Record<ArkGridCoreType, ArkGridCore | null>
> {
  const cores = {} as Record<ArkGridAttr, Record<ArkGridCoreType, ArkGridCore | null>>;

  for (const attr of Object.values(ArkGridAttrs)) {
    cores[attr] = {} as Record<ArkGridCoreType, ArkGridCore | null>;
    for (const type of Object.values(ArkGridCoreTypes)) {
      cores[attr][type] = null; // 코어가 아직 없는 상태
    }
  }

  return cores;
}
export function getProfile(name: string) {
  // 현재 appConfig에서 주어진 이름의 프로필을 조회합니다.
  return appConfig.current.characterProfiles.find((p) => p.characterName === name);
}
export function addNewProfile(profile: CharacterProfile) {
  // 새 CharacterProfile을 appConfig에 등록합니다.
  // 등록에 성공했으면 true, 실패했으면 false를 반환합니다.
  const name = profile.characterName;
  if (name.length == 0 || name.length > 16) return false;
  const existProfile = appConfig.current.characterProfiles.findIndex(
    (p) => p.characterName === name
  );
  if (existProfile != -1) return false;
  appConfig.current.characterProfiles.push(profile);
  return true;
}
export function toggleUI(optionName: keyof UIConfig) {
  appConfig.current.uiConfig[optionName] = !appConfig.current.uiConfig[optionName];
}
export function updateUI(optionName: keyof UIConfig, value: boolean) {
  appConfig.current.uiConfig[optionName] = value;
}

export function toggleDarkMode() {
  appConfig.current.uiConfig.darkMode = !appConfig.current.uiConfig.darkMode;
}
export function enableDarkMode() {
  appConfig.current.uiConfig.darkMode = true;
}
export function toggleDeferredScreenSharingInit() {
  appConfig.current.uiConfig.deferredScreenSharingInit =
    !appConfig.current.uiConfig.deferredScreenSharingInit;
}
