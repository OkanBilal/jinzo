export const MIN_TOKEN_LENGTH = 3;

export const DEFAULT_DECAY_LAMBDA = 0.02;

export const TIME_CONSTANTS = {
  MS_PER_DAY: 1000 * 60 * 60 * 24,
  MS_PER_SECOND: 1000,
} as const;

export const MAX_PER_SOURCE_RATIO = 0.5;

export const DISTANCE_BOUNDS = {
  MAX: 2,
  MIN: 0,
} as const;

export const BM25_PARAMS = {
  K1: 1.5,
  B: 0.75,
} as const;
