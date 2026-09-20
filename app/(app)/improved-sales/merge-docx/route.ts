import { IMPROVED_SALES_PATH } from '@/lib/land-sales/sales-path';
import { makeMergePost } from '../../land-sales/sales-http';

export const runtime = 'nodejs';

export const POST = makeMergePost(IMPROVED_SALES_PATH);
