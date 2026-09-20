import { LAND_SALES_PATH } from '@/lib/land-sales/sales-path';
import { SalesResultsPage } from './land-sales-results';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function LandSalesPage({ searchParams }: PageProps) {
  return <SalesResultsPage path={LAND_SALES_PATH} searchParams={searchParams} />;
}
