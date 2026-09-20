import { IMPROVED_SALES_PATH } from '@/lib/land-sales/sales-path';
import { SalesResultsPage } from '../land-sales/land-sales-results';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function ImprovedSalesPage({ searchParams }: PageProps) {
  return <SalesResultsPage path={IMPROVED_SALES_PATH} searchParams={searchParams} />;
}
