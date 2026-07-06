import type { Bewerbungen } from './app';

export type EnrichedBewerbungen = Bewerbungen & {
  stelleName: string;
};
