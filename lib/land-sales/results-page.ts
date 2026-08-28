import type { LandSale } from './schema';

export type LandSalesPageData = {
  records: LandSale[];
  totalCount: number;
};
