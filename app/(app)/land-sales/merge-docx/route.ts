import { LAND_SALES_PATH } from '@/lib/land-sales/sales-path';
import { makeMergePost } from '../sales-http';

export const runtime = 'nodejs';

export const POST = makeMergePost(LAND_SALES_PATH);
