export const SALES_STAGE_PROBABILITY = {
  identified: 5,
  qualified: 25,
  quoted: 50,
  negotiation: 75,
  waiting_po: 90,
  closed_won: 100,
  closed_lost: 0
} as const;

export type SalesStage = keyof typeof SALES_STAGE_PROBABILITY;

export const CLOSED_STAGES = ['closed_won', 'closed_lost'] as const;
export const OPEN_STAGES = [
  'identified',
  'qualified',
  'quoted',
  'negotiation',
  'waiting_po'
] as const;

export function probabilityForStage<TStage extends SalesStage>(
  stage: TStage
): (typeof SALES_STAGE_PROBABILITY)[TStage] {
  return SALES_STAGE_PROBABILITY[stage];
}

export function isClosedStage(stage: SalesStage): boolean {
  return stage === 'closed_won' || stage === 'closed_lost';
}

export function assertProbabilityMatchesStage(
  stage: SalesStage,
  probabilityPct: number
): void {
  const expected = probabilityForStage(stage);

  if (probabilityPct !== expected) {
    throw new Error(
      `Stage/probability mismatch for ${stage}: expected ${expected}, received ${probabilityPct}`
    );
  }
}
