export class Core {
  constructor(
    public energy: number,
    public point: number,
    public coeff: number[]
  ) {}
}

export class Gem {
  constructor(
    public index: bigint,
    public req: number,
    public point: number,
    public att: number,
    public skill: number,
    public boss: number
  ) {}
}

export function buildScoreMap(coeff: number, maxLevel: number) {
  const result: [number, number][] = [];
  for (let v = 0; v <= maxLevel; v++) {
    let minScore = 100;
    let maxScore = 0;

    // ✅ #6: 상한을 미리 계산하여 루프 오버헤드 감소
    const limit = maxLevel - v;
    for (let base = 0; base <= limit; base++) {
      const coeffAfter = Math.floor(((base + v) * coeff) / 120) + 10000;
      const coeffBefore = Math.floor((base * coeff) / 120) + 10000;

      const upgradeValue = coeffAfter / coeffBefore;
      if (upgradeValue > maxScore) {
        maxScore = upgradeValue;
      }
      if (upgradeValue < minScore) {
        minScore = upgradeValue;
      }
    }
    result[v] = [minScore, maxScore];
  }
  return result;
}

export class GemSet {
  // 코어에 젬을 장착한 상태
  att: number;
  skill: number;
  boss: number;
  point: number;
  bitmask: bigint;
  coreCoeff: number;
  core: Core;
  maxScore: number;
  minScore: number;
  constructor(gems: Gem[], core: Core) {
    this.att = 0;
    this.skill = 0;
    this.boss = 0;
    this.point = 0;

    this.bitmask = 0n;
    for (const gem of gems) {
      this.bitmask |= 1n << gem.index;
      this.att += gem.att;
      this.skill += gem.skill;
      this.boss += gem.boss;
      this.point += gem.point;
    }
    this.coreCoeff = core.coeff[this.point];
    if (this.coreCoeff == undefined) {
      throw Error('Core coeffient is incorrect.');
    }
    this.core = core;
    this.minScore = -1;
    this.maxScore = -1;
  }
  setScoreRange(scoreMaps: [number, number][][]) {
    // 모든 시스템에서 얻을 수 있는 최대 공격력, 추가 피해, 보스 피해를 알 수 있으면
    // 이 GemSet으로 얻을 수 있는 전투력의 범위를 한정할 수 있다.
    const coreScore = (this.coreCoeff + 10000) / 10000;

    // 전투력 증가 최대치
    this.maxScore =
      coreScore *
      scoreMaps[0][this.att][1] *
      scoreMaps[1][this.skill][1] *
      scoreMaps[2][this.boss][1];

    // 전투력 증가 최소치
    this.minScore =
      coreScore *
      scoreMaps[0][this.att][0] *
      scoreMaps[1][this.skill][0] *
      scoreMaps[2][this.boss][0];

    if (this.maxScore < this.minScore) {
      throw Error(`${this.maxScore}이 ${this.minScore}보다 작습니다.`);
    }
  }
}
export class GemSetPack {
  // 질서 혹은 혼돈 3개의 코어에 대해 할당된 3개의 GemSet
  att: number;
  skill: number;
  boss: number;
  coreScore: number;
  minScore: number;
  maxScore: number;
  constructor(
    public gs1: GemSet | null,
    public gs2: GemSet | null,
    public gs3: GemSet | null,
    scoreMaps: [number, number][][]
  ) {
    this.att = (gs1?.att ?? 0) + (gs2?.att ?? 0) + (gs3?.att ?? 0);
    this.skill = (gs1?.skill ?? 0) + (gs2?.skill ?? 0) + (gs3?.skill ?? 0);
    this.boss = (gs1?.boss ?? 0) + (gs2?.boss ?? 0) + (gs3?.boss ?? 0);

    this.coreScore =
      ((((((gs1?.coreCoeff ?? 0) + 10000) / 10000) * ((gs2?.coreCoeff ?? 0) + 10000)) / 10000) *
        ((gs3?.coreCoeff ?? 0) + 10000)) /
      10000;

    // 전투력 증가 최대치
    this.maxScore =
      this.coreScore *
      scoreMaps[0][this.att][1] *
      scoreMaps[1][this.skill][1] *
      scoreMaps[2][this.boss][1];

    // 전투력 증가 최소치
    this.minScore =
      this.coreScore *
      scoreMaps[0][this.att][0] *
      scoreMaps[1][this.skill][0] *
      scoreMaps[2][this.boss][0];

    // if (this.maxScore < this.minScore) {
    //   console.log(this);
    //   throw Error(`${this.maxScore}이 ${this.minScore}보다 작습니다.`);
    // }
  }
}

export const gemOptionLevelCoeffs = [400, 700, 1000]; // 공격력, 추가 피해, 보스 피해
export const gemOptionLevelCoeffsSupporter = [600, 1050, 1500]; // 아피강, 낙인력, 아공강

export class GemSetPackTuple {
  // GemSetPack이 두 개 있는 것, 즉 완성된 하나의 아크 그리드
  att: number;
  skill: number;
  boss: number;
  score: number;
  constructor(
    public gsp1: GemSetPack | null,
    public gsp2: GemSetPack | null,
    public isSupporter: boolean
  ) {
    this.att = (gsp1?.att ?? 0) + (gsp2?.att ?? 0);
    this.skill = (gsp1?.skill ?? 0) + (gsp2?.skill ?? 0);
    this.boss = (gsp1?.boss ?? 0) + (gsp2?.boss ?? 0);
    const coeffs = isSupporter ? gemOptionLevelCoeffsSupporter : gemOptionLevelCoeffs;
    this.score =
      ((((((gsp1?.coreScore ?? 1) *
        (gsp2?.coreScore ?? 1) *
        (Math.floor((this.att * coeffs[0]) / 120) + 10000)) /
        10000) *
        (Math.floor((this.skill * coeffs[1]) / 120) + 10000)) /
        10000) *
        (Math.floor((this.boss * coeffs[2]) / 120) + 10000)) /
      10000;
  }
}
