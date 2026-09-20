import { IMPROVED_SALES_PATH } from '@/lib/land-sales/sales-path';
import { makeExportPost } from '../../land-sales/sales-http';

export const POST = makeExportPost(IMPROVED_SALES_PATH);
