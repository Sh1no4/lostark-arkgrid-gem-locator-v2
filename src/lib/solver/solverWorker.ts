import type { ArkGridAttr } from '../constants/enums';
import type { ArkGridGem, ArkGridGemOptionName } from '../models/arkGridGems';
import {
  Core,
  Gem,
  GemSet,
  GemSetPack,
  GemSetPackTuple,
  buildScoreMap,
  gemOptionLevelCoeffs,
  gemOptionLevelCoeffsSupporter,
} from './models';
import { getBestGemSetPacks, getMaxStat, getPossibleGemSetsFromSortedGems } from './solver';
import type {
  SolverAdditionalGemResult,
  SolverGemSetPackTupleSummary,
  SolverProgress,
  SolverProgressStage,
  SolverRunPayload,
  SolverRunResult,
  SolverWorkerRequest,
  SolverWorkerResponse,
  WorkerCore,
} from './types';
import { gemSetPackPreviewKey } from './utils';

const perfectGems = [
  {
    req: 3,
    point: 5,
    option1: { optionType: '공격력', value: 5 },
    option2: {
      optionType: '추가 피해',
      value: 5,
    },
  },
  {
    req: 4,
    point: 5,
    option1: { optionType: '공격력', value: 5 },
    option2: {
      optionType: '보스 피해',
      value: 5,
    },
  },
  {
    req: 5,
    point: 5,
    option1: {
      optionType: '추가 피해',
      value: 5,
    },
    option2: {
      optionType: '보스 피해',
      value: 5,
    },
  },
] satisfies Partial<ArkGridGem>[];

const perfectGemsSupporter = [
  {
    req: 3,
    point: 5,
    option1: { optionType: '낙인력', value: 5 },
    option2: {
      optionType: '아군 피해 강화',
      value: 5,
    },
  },
  {
    req: 4,
    point: 5,
    option1: { optionType: '아군 피해 강화', value: 5 },
    option2: {
      optionType: '아군 공격 강화',
      value: 5,
    },
  },
  {
    req: 5,
    point: 5,
    option1: {
      optionType: '낙인력',
      value: 5,
    },
    option2: {
      optionType: '아군 공격 강화',
      value: 5,
    },
  },
] satisfies Partial<ArkGridGem>[];

const STAGE_RANGES: Record<SolverProgressStage, [number, number]> = {
  preparing: [0, 10],
  searching_order_packs: [10, 50],
  searching_chaos_packs: [50, 90],
  combining_results: [90, 95],
  simulating_launcher_gems: [95, 99],
  finalizing: [99, 100],
};

type PrecalculatedGspList = {
  order?: GemSetPack[];
  chaos?: GemSetPack[];
  orderMaxStats?: SolverSideMaxStats;
  chaosMaxStats?: SolverSideMaxStats;
};

type SolverSideMaxStats = {
  attMax: number;
  skillMax: number;
  bossMax: number;
};

type StepCallback = (
  orderGspList: GemSetPack[],
  chaosGspList: GemSetPack[],
  sideMaxStats: {
    order: SolverSideMaxStats;
    chaos: SolverSideMaxStats;
  }
) => void;
type ProgressReporter = (progress: SolverProgress) => void;

type SolveOptions = {
  isSupporter?: boolean;
  perfectSolve?: boolean;
  precalculatedGsp?: PrecalculatedGspList;
  onStep?: StepCallback;
};

type SolveResultInternal = {
  answer: GemSetPackTuple;
  assignedGemIndexes: number[][];
  needLauncherGem: Record<ArkGridAttr, boolean>;
};

function calculateGemSetPackTupleScore(
  orderGemSetPack: GemSetPack | null,
  chaosGemSetPack: GemSetPack | null,
  isSupporter: boolean
) {
  const totalAttack = (orderGemSetPack?.att ?? 0) + (chaosGemSetPack?.att ?? 0);
  const totalSkill = (orderGemSetPack?.skill ?? 0) + (chaosGemSetPack?.skill ?? 0);
  const totalBoss = (orderGemSetPack?.boss ?? 0) + (chaosGemSetPack?.boss ?? 0);
  const coeffs = isSupporter ? gemOptionLevelCoeffsSupporter : gemOptionLevelCoeffs;

  return (
    ((((((orderGemSetPack?.coreScore ?? 1) *
      (chaosGemSetPack?.coreScore ?? 1) *
      (Math.floor((totalAttack * coeffs[0]) / 120) + 10000)) /
      10000) *
      (Math.floor((totalSkill * coeffs[1]) / 120) + 10000)) /
      10000) *
      (Math.floor((totalBoss * coeffs[2]) / 120) + 10000)) /
    10000
  );
}

function summarizeGemSetPackTuple(answer: GemSetPackTuple): SolverGemSetPackTupleSummary {
  return {
    gsp1: answer.gsp1 ? { corePointTuple: gemSetPackPreviewKey(answer.gsp1) } : null,
    gsp2: answer.gsp2 ? { corePointTuple: gemSetPackPreviewKey(answer.gsp2) } : null,
    score: answer.score,
  };
}

function getSideMaxStats(gssList: GemSet[][]): SolverSideMaxStats {
  let attMax = 0;
  let skillMax = 0;
  let bossMax = 0;

  for (const gss of gssList) {
    attMax += getMaxStat(gss, 'att');
    skillMax += getMaxStat(gss, 'skill');
    bossMax += getMaxStat(gss, 'boss');
  }

  return { attMax, skillMax, bossMax };
}

function toCore(core: WorkerCore) {
  return new Core(core.energy, core.point, core.coeff);
}

function convertToSolverGems(
  gems: ArkGridGem[],
  isSupporter: boolean
): {
  gems: Gem[];
} {
  const optionIndexMap: ArkGridGemOptionName[] = isSupporter
    ? ['아군 피해 강화', '낙인력', '아군 공격 강화']
    : ['공격력', '추가 피해', '보스 피해'];

  return {
    gems: gems.map((gem, index) => {
      const coeff = [0, 0, 0];

      for (const option of [gem.option1, gem.option2]) {
        const optionIndex = optionIndexMap.findIndex((name) => name === option.optionType);
        if (optionIndex === -1) {
          continue;
        }
        coeff[optionIndex] += option.value;
      }

      return new Gem(BigInt(index), gem.req, gem.point, coeff[0], coeff[1], coeff[2]);
    }),
  };
}

function assignGemIndexes(gs: GemSet | null | undefined): number[] {
  if (!gs) {
    return [];
  }

  let bitmask = gs.bitmask;
  let index = 0;
  const result: number[] = [];

  while (bitmask > 0n) {
    if ((bitmask & 1n) === 1n) {
      result.push(index);
    }
    index += 1;
    bitmask >>= 1n;
  }

  return result;
}

function isGspNeedMoreGem(gsp: GemSetPack | null) {
  if (!gsp) {
    return false;
  }

  return [gsp.gs1, gsp.gs2, gsp.gs3].some((gs) => {
    if (!gs) {
      return false;
    }

    const maxPreviewPoint = Math.min(20, gs.core.coeff.length - 1);

    if (maxPreviewPoint <= 0) {
      return false;
    }

    return gs.point < maxPreviewPoint;
  });
}

function emitProgress(
  report: ProgressReporter | undefined,
  stage: SolverProgressStage,
  stagePercent: number,
  extra?: Omit<SolverProgress, 'stage' | 'stagePercent' | 'totalPercent'>
) {
  if (!report) {
    return;
  }

  const boundedStagePercent = Math.max(0, Math.min(100, stagePercent));
  const [start, end] = STAGE_RANGES[stage];
  const totalPercent = start + ((end - start) * boundedStagePercent) / 100;

  report({
    stage,
    stagePercent: boundedStagePercent,
    totalPercent,
    ...extra,
  });
}

function solve(
  rawOrderCores: WorkerCore[],
  rawChaosCores: WorkerCore[],
  inOrderGems: ArkGridGem[],
  inChaosGems: ArkGridGem[],
  { isSupporter = false, perfectSolve = false, precalculatedGsp, onStep }: SolveOptions = {},
  report?: ProgressReporter
): SolveResultInternal {
  emitProgress(report, 'preparing', 0);
  const orderCores = rawOrderCores.map(toCore);
  const chaosCores = rawChaosCores.map(toCore);
  const canReuseOrderSide = Boolean(precalculatedGsp?.order && precalculatedGsp.orderMaxStats);
  const canReuseChaosSide = Boolean(precalculatedGsp?.chaos && precalculatedGsp.chaosMaxStats);

  const { gems: orderGems } = canReuseOrderSide
    ? { gems: [] }
    : convertToSolverGems(inOrderGems, isSupporter);
  const { gems: chaosGems } = canReuseChaosSide
    ? { gems: [] }
    : convertToSolverGems(inChaosGems, isSupporter);
  const sortedOrderGems = canReuseOrderSide ? [] : [...orderGems].sort((a, b) => a.req - b.req);
  const sortedChaosGems = canReuseChaosSide ? [] : [...chaosGems].sort((a, b) => a.req - b.req);

  const orderGssList = canReuseOrderSide
    ? []
    : orderCores.map((core) => getPossibleGemSetsFromSortedGems(core, sortedOrderGems));
  const chaosGssList = canReuseChaosSide
    ? []
    : chaosCores.map((core) => getPossibleGemSetsFromSortedGems(core, sortedChaosGems));

  if (perfectSolve) {
    for (const gssList of [orderGssList, chaosGssList]) {
      for (let i = 0; i < gssList.length; i++) {
        const gss = gssList[i];
        const seen = new Set<string>();
        const uniqueGss: GemSet[] = [];

        for (const gs of gss) {
          const key = JSON.stringify({
            att: gs.att,
            skill: gs.skill,
            boss: gs.boss,
            coreScore: gs.coreCoeff,
          });
          if (!seen.has(key)) {
            seen.add(key);
            uniqueGss.push(gs);
          }
        }

        gssList[i] = uniqueGss;
      }
    }
  }

  const builtGssList = orderGssList.concat(chaosGssList);
  const orderMaxStats = canReuseOrderSide
    ? precalculatedGsp!.orderMaxStats!
    : getSideMaxStats(orderGssList);
  const chaosMaxStats = canReuseChaosSide
    ? precalculatedGsp!.chaosMaxStats!
    : getSideMaxStats(chaosGssList);
  const attMax = orderMaxStats.attMax + chaosMaxStats.attMax;
  const skillMax = orderMaxStats.skillMax + chaosMaxStats.skillMax;
  const bossMax = orderMaxStats.bossMax + chaosMaxStats.bossMax;

  const gemOptionCoeff = isSupporter ? gemOptionLevelCoeffsSupporter : gemOptionLevelCoeffs;
  const scoreMaps = [
    buildScoreMap(gemOptionCoeff[0], attMax),
    buildScoreMap(gemOptionCoeff[1], skillMax),
    buildScoreMap(gemOptionCoeff[2], bossMax),
  ];

  for (const gss of builtGssList) {
    for (const gs of gss) {
      gs.setScoreRange(scoreMaps);
    }
  }

  emitProgress(report, 'preparing', 100);
  emitProgress(report, 'searching_order_packs', 0);
  const orderGspList = precalculatedGsp?.order
    ? [...precalculatedGsp.order]
    : getBestGemSetPacks(orderGssList, scoreMaps, perfectSolve, ({ current, total }) => {
        emitProgress(report, 'searching_order_packs', (current / total) * 100, {
          current,
          total,
        });
      });

  emitProgress(report, 'searching_order_packs', 100);
  emitProgress(report, 'searching_chaos_packs', 0);
  const chaosGspList = precalculatedGsp?.chaos
    ? [...precalculatedGsp.chaos]
    : getBestGemSetPacks(chaosGssList, scoreMaps, perfectSolve, ({ current, total }) => {
        emitProgress(report, 'searching_chaos_packs', (current / total) * 100, {
          current,
          total,
        });
      });

  if (onStep) {
    onStep(orderGspList, chaosGspList, {
      order: orderMaxStats,
      chaos: chaosMaxStats,
    });
  }

  emitProgress(report, 'searching_chaos_packs', 100);
  emitProgress(report, 'combining_results', 0);
  let answer = new GemSetPackTuple(orderGspList[0] ?? null, chaosGspList[0] ?? null, isSupporter);
  const gemSetPackSet: GemSetPack[][] = [[], []];

  for (const [i, gspList] of [orderGspList, chaosGspList].entries()) {
    const seen = new Set<string>();
    const total = gspList.length;
    let current = 0;
    for (const gsp of gspList) {
      current += 1;
      emitProgress(report, 'combining_results', ((i + current / Math.max(total, 1)) / 4) * 100, {
        current,
        total,
      });
      const key = `${gsp.att}|${gsp.skill}|${gsp.boss}|${gsp.coreScore}`;
      if (!seen.has(key)) {
        seen.add(key);
        gemSetPackSet[i].push(gsp);
      }
    }
  }

  if (gemSetPackSet[0].length > 0 && gemSetPackSet[1].length > 0) {
    const total = gemSetPackSet[0].length;
    let current = 0;
    for (const gsp1 of gemSetPackSet[0]) {
      current += 1;
      emitProgress(report, 'combining_results', 50 + (current / total) * 50, {
        current,
        total,
      });
      for (const gsp2 of gemSetPackSet[1]) {
        const candidateScore = calculateGemSetPackTupleScore(gsp1, gsp2, isSupporter);
        if (candidateScore > answer.score) {
          answer = new GemSetPackTuple(gsp1, gsp2, isSupporter);
        }
      }
    }
  }

  emitProgress(report, 'combining_results', 100);
  return {
    answer,
    assignedGemIndexes: [
      assignGemIndexes(answer.gsp1?.gs1),
      assignGemIndexes(answer.gsp1?.gs2),
      assignGemIndexes(answer.gsp1?.gs3),
      assignGemIndexes(answer.gsp2?.gs1),
      assignGemIndexes(answer.gsp2?.gs2),
      assignGemIndexes(answer.gsp2?.gs3),
    ],
    needLauncherGem: {
      질서: isGspNeedMoreGem(answer.gsp1),
      혼돈: isGspNeedMoreGem(answer.gsp2),
    },
  };
}

function getPerfectScore(isSupporter: boolean) {
  const coeffs = isSupporter ? gemOptionLevelCoeffsSupporter : gemOptionLevelCoeffs;

  if (!isSupporter) {
    return (
      ((((((1.09 *
        1.09 *
        1.06 *
        1.04 *
        1.04 *
        1.04 *
        (Math.floor((60 * coeffs[0]) / 120) + 10000)) /
        10000) *
        (Math.floor((90 * coeffs[1]) / 120) + 10000)) /
        10000) *
        (Math.floor((90 * coeffs[2]) / 120) + 10000)) /
        10000 -
        1) *
      100
    );
  }

  return (
    ((((((1.0942 *
      1.0942 *
      1.033 *
      1.06 *
      1.06 *
      1.0353 *
      (Math.floor((60 * coeffs[0]) / 120) + 10000)) /
      10000) *
      (Math.floor((90 * coeffs[1]) / 120) + 10000)) /
      10000) *
      (Math.floor((90 * coeffs[2]) / 120) + 10000)) /
      10000 -
      1) *
    100
  );
}

function createProgressReporter(postProgress: ProgressReporter): ProgressReporter {
  let lastTotalPercent = -1;
  let lastStagePercent = -1;
  let lastStage: SolverProgressStage | null = null;

  return (progress) => {
    const roundedTotalPercent = Math.max(0, Math.min(100, Math.round(progress.totalPercent)));
    const roundedStagePercent = Math.max(0, Math.min(100, Math.round(progress.stagePercent)));

    if (
      roundedTotalPercent === lastTotalPercent &&
      roundedStagePercent === lastStagePercent &&
      progress.stage === lastStage
    ) {
      return;
    }

    lastTotalPercent = roundedTotalPercent;
    lastStagePercent = roundedStagePercent;
    lastStage = progress.stage;

    postProgress({
      ...progress,
      totalPercent: roundedTotalPercent,
      stagePercent: roundedStagePercent,
    });
  };
}

function createPreviewGem(attr: ArkGridAttr, req: number, point: number): ArkGridGem {
  return {
    gemAttr: attr,
    req,
    point,
    option1: { optionType: '공격력', value: 0 },
    option2: { optionType: '추가 피해', value: 0 },
  };
}

function createPreviewCandidates(attr: ArkGridAttr) {
  const result: ArkGridGem[] = [];

  for (let gemPoint = 5; gemPoint >= 1; gemPoint--) {
    for (let gemReq = 3; gemReq < 10; gemReq++) {
      result.push(createPreviewGem(attr, gemReq, gemPoint));
    }
  }

  return result;
}

function runSolve(payload: SolverRunPayload, report: ProgressReporter): SolverRunResult {
  const { orderCores, chaosCores, orderGems, chaosGems, isSupporter } = payload;
  const perfectOrderGems: ArkGridGem[] = [];
  const perfectChaosGems: ArkGridGem[] = [];

  for (const gem of isSupporter ? perfectGemsSupporter : perfectGems) {
    for (let i = 0; i < 4; i++) {
      perfectOrderGems.push({ gemAttr: '질서', ...gem });
      perfectChaosGems.push({ gemAttr: '혼돈', ...gem });
    }
  }

  let precalculatedGspListOrder: PrecalculatedGspList | undefined;
  let precalculatedGspListChaos: PrecalculatedGspList | undefined;

  const solved = solve(
    orderCores,
    chaosCores,
    orderGems,
    chaosGems,
    {
      isSupporter,
      onStep: (order, chaos, sideMaxStats) => {
        precalculatedGspListOrder = {
          order,
          orderMaxStats: sideMaxStats.order,
        };
        precalculatedGspListChaos = {
          chaos,
          chaosMaxStats: sideMaxStats.chaos,
        };
      },
    },
    report
  );

  const answer = solved.answer;
  const score = (answer.score - 1) * 100;
  const bestScore =
    (solve(orderCores, chaosCores, perfectOrderGems, perfectChaosGems, {
      isSupporter,
      perfectSolve: true,
    }).answer.score -
      1) *
    100;

  const additionalGemResult: SolverAdditionalGemResult = {
    질서: {},
    혼돈: {},
  };

  const simulationTargets = [
    { attr: '질서', gsp: answer.gsp1 },
    { attr: '혼돈', gsp: answer.gsp2 },
  ] satisfies { attr: ArkGridAttr; gsp: GemSetPack | null }[];
  const shouldSimulateLauncherGems = simulationTargets.some(({ gsp }) => Boolean(gsp));
  const previewCandidatesByAttr = new Map<ArkGridAttr, ArkGridGem[]>();
  let totalPreviewCandidateCount = 0;

  for (const { attr, gsp } of simulationTargets) {
    if (!gsp) {
      previewCandidatesByAttr.set(attr, []);
      continue;
    }

    const currentKeyRaw = gemSetPackPreviewKey(gsp);
    const isMaxPreviewKey = currentKeyRaw.every((corePoint) => corePoint === 20);
    const candidates = isMaxPreviewKey ? [] : createPreviewCandidates(attr);
    previewCandidatesByAttr.set(attr, candidates);
    totalPreviewCandidateCount += candidates.length;
  }
  let completedPreviewCandidateCount = 0;

  if (shouldSimulateLauncherGems) {
    emitProgress(report, 'simulating_launcher_gems', 0, {
      current: 0,
      total: totalPreviewCandidateCount,
    });
  }

  for (const { attr, gsp } of simulationTargets) {
    if (!gsp) {
      continue;
    }

    const currentKeyRaw = gemSetPackPreviewKey(gsp);
    const currentKey = currentKeyRaw.join(',');
    const attrPreviewCandidates = [...(previewCandidatesByAttr.get(attr) ?? [])];
    const dominatedPreviewPoints = new Set<number>();
    if (attrPreviewCandidates.length === 0) {
      continue;
    }

    for (const newGem of attrPreviewCandidates) {
      const gemPoint = newGem.point;

      if (dominatedPreviewPoints.has(gemPoint)) {
        continue;
      }

      completedPreviewCandidateCount += 1;
      const currentPreviewCandidateCount = completedPreviewCandidateCount;

      emitProgress(
        report,
        'simulating_launcher_gems',
        (currentPreviewCandidateCount / Math.max(totalPreviewCandidateCount, 1)) * 100,
        {
          attr,
          current: currentPreviewCandidateCount,
          total: totalPreviewCandidateCount,
        }
      );

      const nextSolve = solve(
        orderCores,
        chaosCores,
        attr === '질서' ? [...orderGems, newGem] : orderGems,
        attr === '혼돈' ? [...chaosGems, newGem] : chaosGems,
          {
            isSupporter,
            precalculatedGsp:
              attr === '혼돈' ? precalculatedGspListOrder : precalculatedGspListChaos,
          }
        );

      const nextGsp = attr === '질서' ? nextSolve.answer.gsp1 : nextSolve.answer.gsp2;
      if (!nextGsp) {
        dominatedPreviewPoints.add(gemPoint);
        continue;
      }

      const newKeyRaw = gemSetPackPreviewKey(nextGsp);
      const newKey = newKeyRaw.join(',');
      const targetAdditionalGem = additionalGemResult[attr];
      const previewCandidateImprovedAnswer = newKey !== currentKey && nextSolve.answer.score > answer.score;

      if (previewCandidateImprovedAnswer) {
        if (targetAdditionalGem[newKey]) {
          targetAdditionalGem[newKey].gems.push(newGem);
          if (targetAdditionalGem[newKey].score < nextSolve.answer.score) {
            targetAdditionalGem[newKey].score = nextSolve.answer.score;
          }
        } else {
          targetAdditionalGem[newKey] = {
            corePointTuple: newKeyRaw,
            gems: [newGem],
            score: nextSolve.answer.score,
          };
        }
      } else {
        // Same point and higher requirement is strictly less flexible, so later candidates cannot improve either.
        dominatedPreviewPoints.add(gemPoint);
      }
    }
  }

  if (shouldSimulateLauncherGems) {
    emitProgress(report, 'simulating_launcher_gems', 100);
  }
  emitProgress(report, 'finalizing', 100);

  return {
    assignedGemIndexes: solved.assignedGemIndexes,
    gemSetPackTuple: summarizeGemSetPackTuple(answer),
    scoreSet: {
      score,
      bestScore,
      perfectScore: getPerfectScore(isSupporter),
    },
    additionalGemResult,
    needLauncherGem: solved.needLauncherGem,
  };
}

self.onmessage = (e: MessageEvent<SolverWorkerRequest>) => {
  const data = e.data;

  switch (data.type) {
    case 'runSolve':
      try {
        const report = createProgressReporter((progress) => {
          self.postMessage({
            type: 'runSolve:progress',
            progress,
          } satisfies SolverWorkerResponse);
        });

        self.postMessage({
          type: 'runSolve:done',
          result: runSolve(data.payload, report),
        } satisfies SolverWorkerResponse);
      } catch (error) {
        self.postMessage({
          type: 'runSolve:error',
          message: error instanceof Error ? error.message : String(error),
        } satisfies SolverWorkerResponse);
      }
      break;
  }
};
