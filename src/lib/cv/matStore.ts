/**
 * 스프라이트 이미지를 한 번 fetch → cv.Mat 생성
 */
import {
  type ArkGridAttr,
  type GemRecognitionLocale,
  supportedGemRecognitionLocales,
} from '../constants/enums';
import { type ArkGridGemName, type ArkGridGemOptionName } from '../models/arkGridGems';
import { type EnUsTemplateName, enUsCoords, enUsFileName } from '../opencv-template-coords/en_us';
import { type KoKrTemplateName, koKrCoords, koKrFileName } from '../opencv-template-coords/ko_kr';
import { type RuCnTemplateName, ruCnCoords, ruCnFileName } from '../opencv-template-coords/ru_cn';
import { type RuRuTemplateName, ruRuCoords, ruRuFileName } from '../opencv-template-coords/ru_ru';
import { type ZhCnTemplateName, zhCnCoords, zhCnFileName } from '../opencv-template-coords/zh_cn';
import { type MatchingAtlas, generateMatchingAtlas } from './atlas';
import { getCv } from './cvRuntime';
import type { CvMat } from './types';

export type KeyBaseWillPower = '3' | '4' | '5' | '6' | '7' | '8' | '9';
export type KeyAlternateWillPower = '3_1' | '4_1' | '5_1' | '6_1' | '7_1' | '8_1' | '9_1';
export type KeyWillPower = KeyBaseWillPower | KeyAlternateWillPower;
export type KeyCorePoint = '1' | '2' | '3' | '4' | '5';
export type KeyOptionString = ArkGridGemOptionName;
export type KeyOptionLevel = '1' | '2' | '3' | '4' | '5';
export type KeyGemAttr = ArkGridAttr;
export type KeyGemName = ArkGridGemName;

// ru_cn 新旧两套字体。带 `_1` 的是“新分支字体”模板，
// 识别结果键需经 stripVariant 剥掉后缀后再使用。
export type KeyAnchorAll = 'anchor' | 'anchor_1';
export type KeyGemAttrAll = KeyGemAttr | `${KeyGemAttr}_1`;
export type KeyCorePointAll = KeyCorePoint | `${KeyCorePoint}_1`;
export type KeyOptionLevelAll = KeyOptionLevel | `${KeyOptionLevel}_1`;
export type KeyOptionStringAll = KeyOptionString | `${KeyOptionString}_1`;

type TemplateCoordMap = Record<string, { x: number; y: number; w: number; h: number }>;

async function fetchSpriteMat(url: string): Promise<CvMat> {
  // url 이미지를 읽어온 뒤 Mat으로 변환
  const cv = getCv();
  const img = await createImageBitmap(await fetch(url).then((r) => r.blob()));
  const off = new OffscreenCanvas(img.width, img.height);
  const ctx = off.getContext('2d');
  if (!ctx) throw new Error('Canvas context creation failed');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, img.width, img.height);
  const mat = cv.matFromImageData(data);
  cv.cvtColor(mat, mat, cv.COLOR_RGBA2GRAY);
  img.close();
  return mat;
}

type GemTemplates = {
  ko_kr: Record<KoKrTemplateName, CvMat>;
  en_us: Record<EnUsTemplateName, CvMat>;
  ru_ru: Record<RuRuTemplateName, CvMat>;
  ru_cn: Record<RuCnTemplateName, CvMat>;
  zh_cn: Record<ZhCnTemplateName, CvMat>;
};
async function loadLocaleTemplates<TTemplateName extends string>(
  fileName: string,
  coords: Record<TTemplateName, { x: number; y: number; w: number; h: number }>
): Promise<Record<TTemplateName, CvMat>> {
  const cv = getCv();
  const sprite = await fetchSpriteMat(`${import.meta.env.BASE_URL}/${fileName}`);
  const templates = {} as Record<TTemplateName, CvMat>;

  for (const [name, rect] of Object.entries(coords) as [TTemplateName, TemplateCoordMap[string]][]) {
    templates[name] = sprite.roi(new cv.Rect(rect.x, rect.y, rect.w, rect.h));
  }

  sprite.delete();
  return templates;
}

async function loadGemTemplates(): Promise<GemTemplates> {
  return {
    ko_kr: await loadLocaleTemplates(koKrFileName, koKrCoords),
    en_us: await loadLocaleTemplates(enUsFileName, enUsCoords),
    ru_ru: await loadLocaleTemplates(ruRuFileName, ruRuCoords),
    ru_cn: await loadLocaleTemplates(ruCnFileName, ruCnCoords),
    zh_cn: await loadLocaleTemplates(zhCnFileName, zhCnCoords),
  };
}

/**
 * ru_cn 双字体并集工具。
 * `_1` 结尾=新分支字体。识别时新旧字体模板同时进图集、取最佳匹配；
 * 命中键带 `_1` 时，先用 stripVariant 归一化再写入结果。
 */
export function stripVariant<K extends string>(key: K): K extends `${infer Base}_1` ? Base : K {
  return key.replace(/_1$/, '') as K extends `${infer Base}_1` ? Base : K;
}

type AlternateDef<K extends string> = { key: K; fileName: string };

function buildAltUnion<const K extends string, const A extends string>(
  locale: GemRecognitionLocale,
  mats: Partial<Record<string, CvMat>>,
  base: Record<K, CvMat>,
  alternates: readonly AlternateDef<A>[]
): Record<K | A, CvMat> {
  const union = { ...base } as Record<K | A, CvMat>;
  if (locale === 'ru_cn') {
    for (const alt of alternates) {
      const mat = mats[alt.fileName];
      if (mat) union[alt.key] = mat;
    }
  }
  return union;
}

const alternateRuCnWillPowerTemplates = [
  { key: '3_1', fileName: '3_1.png' },
  { key: '4_1', fileName: '4_1.png' },
  { key: '5_1', fileName: '5_1.png' },
  { key: '6_1', fileName: '6_1.png' },
  { key: '7_1', fileName: '7_1.png' },
  { key: '8_1', fileName: '8_1.png' },
  { key: '9_1', fileName: '9_1.png' },
] as const satisfies readonly AlternateDef<KeyAlternateWillPower>[];

const baseWillPowerTemplateNames = ['3', '4', '5', '6', '7', '8', '9'] as const;

function buildWillPowerTemplates(
  locale: GemRecognitionLocale,
  mats: Partial<Record<string, CvMat>>
): Record<KeyWillPower, CvMat> {
  const base = {} as Record<KeyBaseWillPower, CvMat>;
  for (const templateName of baseWillPowerTemplateNames) {
    const mat = mats[`${templateName}.png`];
    if (mat) base[templateName] = mat;
  }
  return buildAltUnion<KeyBaseWillPower, KeyAlternateWillPower>(
    locale,
    mats,
    base,
    alternateRuCnWillPowerTemplates
  );
}

const ruCnAlternateAnchor = [
  { key: 'anchor_1', fileName: 'anchor_1.png' },
] as const satisfies readonly AlternateDef<'anchor_1'>[];

const ruCnAlternateGemAttr = [
  { key: '질서_1', fileName: '질서_1.png' },
  { key: '혼돈_1', fileName: '혼돈_1.png' },
] as const satisfies readonly AlternateDef<`${ArkGridAttr}_1`>[];

const ruCnAlternateCorePoint = [
  { key: '1_1', fileName: '1_1.png' },
  { key: '2_1', fileName: '2_1.png' },
  { key: '3_1', fileName: '3_1.png' },
  { key: '4_1', fileName: '4_1.png' },
  { key: '5_1', fileName: '5_1.png' },
] as const satisfies readonly AlternateDef<KeyCorePointAll>[];

const ruCnAlternateOptionLevel = [
  { key: '1_1', fileName: 'lv1_1.png' },
  { key: '2_1', fileName: 'lv2_1.png' },
  { key: '3_1', fileName: 'lv3_1.png' },
  { key: '4_1', fileName: 'lv4_1.png' },
  { key: '5_1', fileName: 'lv5_1.png' },
] as const satisfies readonly AlternateDef<KeyOptionLevelAll>[];

const ruCnAlternateOptionName = [
  { key: '공격력_1', fileName: '공격력_1.png' },
  { key: '추가 피해_1', fileName: '추가피해_1.png' },
  { key: '보스 피해_1', fileName: '보스피해_1.png' },
  { key: '낙인력_1', fileName: '낙인력_1.png' },
  { key: '아군 공격 강화_1', fileName: '아군공격강화_1.png' },
  { key: '아군 피해 강화_1', fileName: '아군피해강화_1.png' },
] as const satisfies readonly AlternateDef<KeyOptionStringAll>[];

export function normalizeWillPowerKey(key: KeyWillPower): KeyBaseWillPower {
  return stripVariant(key) as KeyBaseWillPower;
}

export async function loadGemAsset() {
  const gt = await loadGemTemplates();

  const atlasAnchorByLocale = supportedGemRecognitionLocales.reduce(
    (acc, locale) => {
      const mats = gt[locale];
      acc[locale] = generateMatchingAtlas(
        buildAltUnion(locale, mats, { anchor: mats['anchor.png'] }, ruCnAlternateAnchor)
      );
      return acc;
    },
    {} as Record<GemRecognitionLocale, MatchingAtlas<KeyAnchorAll>>
  );

  const atlasGemAttr = supportedGemRecognitionLocales.reduce(
    (acc, locale) => {
      const mats = gt[locale];
      acc[locale] = generateMatchingAtlas(
        buildAltUnion(
          locale,
          mats,
          { 질서: mats['질서.png'], 혼돈: mats['혼돈.png'] },
          ruCnAlternateGemAttr
        )
      );
      return acc;
    },
    {} as Record<GemRecognitionLocale, MatchingAtlas<KeyGemAttrAll>>
  );

  const atlasWillPower = supportedGemRecognitionLocales.reduce(
    (acc, locale) => {
      const mats = gt[locale];
      acc[locale] = generateMatchingAtlas(buildWillPowerTemplates(locale, mats));
      return acc;
    },
    {} as Record<GemRecognitionLocale, MatchingAtlas<KeyWillPower>>
  );

  const atlasTopWillPower = supportedGemRecognitionLocales.reduce(
    (acc, locale) => {
      const mats = gt[locale];
      acc[locale] = generateMatchingAtlas(buildWillPowerTemplates(locale, mats));
      return acc;
    },
    {} as Record<GemRecognitionLocale, MatchingAtlas<KeyWillPower>>
  );

  const atlasCorePoint = supportedGemRecognitionLocales.reduce(
    (acc, locale) => {
      const mats = gt[locale];
      acc[locale] = generateMatchingAtlas(
        buildAltUnion(
          locale,
          mats,
          {
            1: mats['1.png'],
            2: mats['2.png'],
            3: mats['3.png'],
            4: mats['4.png'],
            5: mats['5.png'],
          },
          ruCnAlternateCorePoint
        )
      );
      return acc;
    },
    {} as Record<GemRecognitionLocale, MatchingAtlas<KeyCorePointAll>>
  );

  const altasGemImage = supportedGemRecognitionLocales.reduce(
    (acc, locale) => {
      const mats = gt[locale];
      acc[locale] = generateMatchingAtlas({
        '질서의 젬 : 안정': mats['안정.png'],
        '질서의 젬 : 견고': mats['견고.png'],
        '질서의 젬 : 불변': mats['불변.png'],
        '혼돈의 젬 : 침식': mats['침식.png'],
        '혼돈의 젬 : 왜곡': mats['왜곡.png'],
        '혼돈의 젬 : 붕괴': mats['붕괴.png'],
      });
      return acc;
    },
    {} as Record<GemRecognitionLocale, MatchingAtlas<KeyGemName>>
  );

  const atlasOptionName = supportedGemRecognitionLocales.reduce(
    (acc, locale) => {
      const mats = gt[locale];
      acc[locale] = generateMatchingAtlas(
        buildAltUnion(
          locale,
          mats,
          {
            공격력: mats['공격력.png'],
            '추가 피해': mats['추가피해.png'],
            '보스 피해': mats['보스피해.png'],
            낙인력: mats['낙인력.png'],
            '아군 공격 강화': mats['아군공격강화.png'],
            '아군 피해 강화': mats['아군피해강화.png'],
          },
          ruCnAlternateOptionName
        )
      );
      return acc;
    },
    {} as Record<GemRecognitionLocale, MatchingAtlas<KeyOptionStringAll>>
  );

  const atlasOptionLevel = supportedGemRecognitionLocales.reduce(
    (acc, locale) => {
      const mats = gt[locale];
      acc[locale] = generateMatchingAtlas(
        buildAltUnion(
          locale,
          mats,
          {
            1: mats['lv1.png'],
            2: mats['lv2.png'],
            3: mats['lv3.png'],
            4: mats['lv4.png'],
            5: mats['lv5.png'],
          },
          ruCnAlternateOptionLevel
        )
      );
      return acc;
    },
    {} as Record<GemRecognitionLocale, MatchingAtlas<KeyOptionLevelAll>>
  );

  return {
    atlasAnchorByLocale,
    atlasGemAttr,
    altasGemImage,
    atlasWillPower,
    atlasTopWillPower,
    atlasCorePoint,
    atlasOptionName,
    atlasOptionLevel,
  };
}
