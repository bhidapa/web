import * as prijave from './prijave';

export type ImePrijave = keyof typeof prijave;

export type Attributes = { imePrijave: ImePrijave };
