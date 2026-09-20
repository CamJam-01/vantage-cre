import { LAND_SALES_PATH } from '@/lib/land-sales/sales-path';
import { SalesRecordPage } from './sales-record-page';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
};

export default function RecordDetailsPage(props: PageProps) {
  return <SalesRecordPage path={LAND_SALES_PATH} {...props} />;
}
