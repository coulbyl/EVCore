import Decimal from 'decimal.js';

export type LadderStepInput = {
  combinedOdds: string;
  jointProbability: string;
};

export type LadderSimulationInput = {
  stake: string;
  steps: LadderStepInput[];
};

export type LadderSimulationStep = {
  index: number;
  stake: string;
  combinedOdds: string;
  jointProbability: string;
  potentialReturn: string;
  cumulativeProbability: string;
  loseBeforeOrAtStepProbability: string;
};

export type LadderSimulationResult = {
  initialStake: string;
  finalPotentialReturn: string;
  cumulativeProbability: string;
  loseProbability: string;
  expectedValue: string;
  steps: LadderSimulationStep[];
};

function money(value: Decimal): string {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

function probability(value: Decimal): string {
  return value.toDecimalPlaces(6, Decimal.ROUND_HALF_UP).toString();
}

export function simulateLadder(
  input: LadderSimulationInput,
): LadderSimulationResult {
  const initialStake = new Decimal(input.stake);
  let currentStake = initialStake;
  let cumulativeProbability = new Decimal(1);

  const steps = input.steps.map((step, index) => {
    const combinedOdds = new Decimal(step.combinedOdds);
    const jointProbability = new Decimal(step.jointProbability);
    const potentialReturn = currentStake.mul(combinedOdds);
    cumulativeProbability = cumulativeProbability.mul(jointProbability);
    const loseProbability = new Decimal(1).minus(cumulativeProbability);

    const output: LadderSimulationStep = {
      index: index + 1,
      stake: money(currentStake),
      combinedOdds: combinedOdds.toString(),
      jointProbability: probability(jointProbability),
      potentialReturn: money(potentialReturn),
      cumulativeProbability: probability(cumulativeProbability),
      loseBeforeOrAtStepProbability: probability(loseProbability),
    };

    currentStake = potentialReturn;
    return output;
  });

  const finalPotentialReturn = currentStake;
  const expectedValue = finalPotentialReturn
    .mul(cumulativeProbability)
    .minus(initialStake);

  return {
    initialStake: money(initialStake),
    finalPotentialReturn: money(finalPotentialReturn),
    cumulativeProbability: probability(cumulativeProbability),
    loseProbability: probability(new Decimal(1).minus(cumulativeProbability)),
    expectedValue: money(expectedValue),
    steps,
  };
}
