import type { ChannelStrategyLeagueConfig } from "./channel-strategy-config.types";

export const WIN_EITHER_HALF_CONFIG: Record<
  string,
  ChannelStrategyLeagueConfig
> = {
  ARG1: { enabled: true, threshold: 0.49, minSampleN: 20 }, // WEH home base 0.5358, away 0.3688, n=1521
  ARG2: { enabled: true, threshold: 0.51, minSampleN: 20 }, // WEH home base 0.5590, away 0.3379, n=2406
  AUS1: { enabled: true, threshold: 0.51, minSampleN: 20 }, // WEH home base 0.5610, away 0.5236, n=508
  AUT1: { enabled: true, threshold: 0.49, minSampleN: 20 }, // WEH home base 0.5350, away 0.4615, n=585
  BEL1: { enabled: true, threshold: 0.52, minSampleN: 20 }, // WEH home base 0.5720, away 0.4469, n=951
  BL1: { enabled: true, threshold: 0.52, minSampleN: 20 }, // WEH home base 0.5714, away 0.4805, n=924
  BRA1: { enabled: true, threshold: 0.56, minSampleN: 20 }, // WEH home base 0.6066, away 0.4038, n=1159
  BRA2: { enabled: true, threshold: 0.54, minSampleN: 20 }, // WEH home base 0.5947, away 0.3817, n=1310
  CH: { enabled: true, threshold: 0.53, minSampleN: 20 }, // WEH home base 0.5757, away 0.4554, n=1671
  CHI1: { enabled: true, threshold: 0.53, minSampleN: 20 }, // WEH home base 0.5828, away 0.4505, n=839
  CHI2: { enabled: true, threshold: 0.5, minSampleN: 20 }, // WEH home base 0.5515, away 0.4668, n=602
  CHN2: { enabled: true, threshold: 0.51, minSampleN: 20 }, // WEH home base 0.5585, away 0.4077, n=829
  CSL: { enabled: true, threshold: 0.56, minSampleN: 20 }, // WEH home base 0.6058, away 0.4696, n=756
  CZE1: { enabled: true, threshold: 0.53, minSampleN: 20 }, // WEH home base 0.5824, away 0.4335, n=819
  D2: { enabled: true, threshold: 0.57, minSampleN: 20 }, // WEH home base 0.6190, away 0.4859, n=924
  D3: { enabled: true, threshold: 0.56, minSampleN: 20 }, // WEH home base 0.6061, away 0.4570, n=1140
  DEN1: { enabled: true, threshold: 0.53, minSampleN: 20 }, // WEH home base 0.5786, away 0.4922, n=579
  EL1: { enabled: true, threshold: 0.53, minSampleN: 20 }, // WEH home base 0.5829, away 0.4758, n=1671
  EL2: { enabled: true, threshold: 0.52, minSampleN: 20 }, // WEH home base 0.5673, away 0.4638, n=1671
  ERD: { enabled: true, threshold: 0.54, minSampleN: 20 }, // WEH home base 0.5864, away 0.4607, n=955
  EST1: { enabled: true, threshold: 0.49, minSampleN: 20 }, // WEH home base 0.5357, away 0.5078, n=575
  F2: { enabled: true, threshold: 0.51, minSampleN: 20 }, // WEH home base 0.5616, away 0.4575, n=999
  FIN1: { enabled: true, threshold: 0.53, minSampleN: 20 }, // WEH home base 0.5758, away 0.4759, n=561
  FIN2: { enabled: true, threshold: 0.51, minSampleN: 20 }, // WEH home base 0.5598, away 0.4665, n=343
  FRI: { enabled: true, threshold: 0.54, minSampleN: 20 }, // WEH home base 0.5929, away 0.4159, n=339
  GRE1: { enabled: true, threshold: 0.51, minSampleN: 20 }, // WEH home base 0.5640, away 0.4501, n=711
  I2: { enabled: true, threshold: 0.52, minSampleN: 20 }, // WEH home base 0.5697, away 0.4380, n=1169
  IRL1: { enabled: true, threshold: 0.53, minSampleN: 20 }, // WEH home base 0.5798, away 0.4473, n=664
  ISL1: { enabled: true, threshold: 0.58, minSampleN: 20 }, // WEH home base 0.6319, away 0.4611, n=527
  J1: { enabled: true, threshold: 0.49, minSampleN: 20 }, // WEH home base 0.5403, away 0.4597, n=1266
  KOR1: { enabled: true, threshold: 0.5, minSampleN: 20 }, // WEH home base 0.5452, away 0.4562, n=708
  KOR2: { enabled: true, threshold: 0.47, minSampleN: 20 }, // WEH home base 0.5176, away 0.4892, n=883
  KSA1: { enabled: true, threshold: 0.52, minSampleN: 20 }, // WEH home base 0.5719, away 0.4869, n=918
  L1: { enabled: true, threshold: 0.52, minSampleN: 20 }, // WEH home base 0.5708, away 0.4584, n=925
  LAT1: { enabled: true, threshold: 0.52, minSampleN: 20 }, // WEH home base 0.5702, away 0.4623, n=584
  LL: { enabled: true, threshold: 0.56, minSampleN: 20 }, // WEH home base 0.6088, away 0.4404, n=1140
  MLS: { enabled: true, threshold: 0.56, minSampleN: 20 }, // WEH home base 0.6095, away 0.4708, n=1132
  MX1: { enabled: true, threshold: 0.56, minSampleN: 20 }, // WEH home base 0.6132, away 0.4262, n=1016
  NOR1: { enabled: true, threshold: 0.54, minSampleN: 20 }, // WEH home base 0.5879, away 0.4664, n=774
  NOR2: { enabled: true, threshold: 0.55, minSampleN: 20 }, // WEH home base 0.6013, away 0.4893, n=795
  PL: { enabled: true, threshold: 0.54, minSampleN: 20 }, // WEH home base 0.5947, away 0.4770, n=1520
  POL1: { enabled: true, threshold: 0.55, minSampleN: 20 }, // WEH home base 0.6002, away 0.4412, n=918
  POL2: { enabled: true, threshold: 0.52, minSampleN: 20 }, // WEH home base 0.5703, away 0.4838, n=924
  POR: { enabled: true, threshold: 0.52, minSampleN: 20 }, // WEH home base 0.5660, away 0.4643, n=924
  RUS1: { enabled: true, threshold: 0.55, minSampleN: 20 }, // WEH home base 0.5956, away 0.4426, n=732
  SA: { enabled: true, threshold: 0.5, minSampleN: 20 }, // WEH home base 0.5461, away 0.4732, n=1139
  SCO1: { enabled: true, threshold: 0.55, minSampleN: 20 }, // WEH home base 0.6040, away 0.4644, n=702
  SP2: { enabled: true, threshold: 0.54, minSampleN: 20 }, // WEH home base 0.5852, away 0.4041, n=1403
  SRB1: { enabled: true, threshold: 0.52, minSampleN: 20 }, // WEH home base 0.5661, away 0.4686, n=892
  SUI1: { enabled: true, threshold: 0.56, minSampleN: 20 }, // WEH home base 0.6145, away 0.4681, n=690
  SUI2: { enabled: true, threshold: 0.51, minSampleN: 20 }, // WEH home base 0.5576, away 0.4851, n=538
  SVN1: { enabled: true, threshold: 0.55, minSampleN: 20 }, // WEH home base 0.6019, away 0.4769, n=520
  SWE1: { enabled: true, threshold: 0.52, minSampleN: 20 }, // WEH home base 0.5709, away 0.4853, n=783
  SWE2: { enabled: true, threshold: 0.55, minSampleN: 20 }, // WEH home base 0.5952, away 0.4492, n=788
  TUR1: { enabled: true, threshold: 0.56, minSampleN: 20 }, // WEH home base 0.6076, away 0.4460, n=1027
  TUR2: { enabled: true, threshold: 0.51, minSampleN: 20 }, // WEH home base 0.5611, away 0.4306, n=1080
  UCL: { enabled: true, threshold: 0.55, minSampleN: 20 }, // WEH home base 0.6040, away 0.4398, n=798
  UECL: { enabled: true, threshold: 0.55, minSampleN: 20 }, // WEH home base 0.6008, away 0.4310, n=1260
  UEL: { enabled: true, threshold: 0.57, minSampleN: 20 }, // WEH home base 0.6172, away 0.4355, n=721
  UNL: { enabled: true, threshold: 0.55, minSampleN: 20 }, // WEH home base 0.6043, away 0.4652, n=187
  USA2: { enabled: true, threshold: 0.52, minSampleN: 20 }, // WEH home base 0.5716, away 0.4398, n=1396
  WC: { enabled: true, threshold: 0.54, minSampleN: 20 }, // WEH home base 0.5879, away 0.4303, n=165
  WCQAF: { enabled: true, threshold: 0.48, minSampleN: 20 }, // WEH home base 0.5300, away 0.4317, n=417
  WCQAS: { enabled: true, threshold: 0.5, minSampleN: 20 }, // WEH home base 0.5507, away 0.4361, n=454
  WCQCA: { enabled: true, threshold: 0.53, minSampleN: 20 }, // WEH home base 0.5760, away 0.3825, n=217
  WCQE: { enabled: true, threshold: 0.51, minSampleN: 20 }, // WEH home base 0.5563, away 0.4827, n=462
  WCQSA: { enabled: true, threshold: 0.55, minSampleN: 20 }, // WEH home base 0.6034, away 0.3073, n=179
};

export const WIN_EITHER_HALF_DEFAULT: ChannelStrategyLeagueConfig = {
  enabled: false,
  threshold: 0.99,
  minSampleN: 20,
};
