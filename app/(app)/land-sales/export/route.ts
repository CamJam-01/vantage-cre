import { LAND_SALES_PATH } from '@/lib/land-sales/sales-path';
import { makeExportPost } from '../sales-http';

export const POST = makeExportPost(LAND_SALES_PATH);
