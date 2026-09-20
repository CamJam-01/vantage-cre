import { IMPROVED_SALES_PATH } from '@/lib/land-sales/sales-path';
import { SalesRecordPage } from '../../land-sales/[id]/sales-record-page';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
};

export default function ImprovedRecordDetailsPage(props: PageProps) {
  return <SalesRecordPage path={IMPROVED_SALES_PATH} {...props} />;
}
