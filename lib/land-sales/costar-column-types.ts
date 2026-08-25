export type CostarColumnType = 'text' | 'number' | 'date' | 'boolean';

const NUMBER_COLUMNS = new Set([
  'Land Area AC',
  'Land Area SF',
  'Sale Price',
  'Asking Price',
  'Price Per AC Land',
  'Price Per SF Land',
  'Actual Cap Rate',
  'Assessed Improved',
  'Assessed Land',
  'Assessed Value',
  'Assessed Year',
  'Comp ID',
  'Down Payment',
  'First Trust Deed Balance',
  'Improvement Ratio',
  'Land SF Gross',
  'Land SF Net',
  'Latitude',
  'Longitude',
  'Market Time',
  'Number of Floors',
  'Number of Tenants',
  'Percent Leased',
  'Price Per AC Land Net',
  'Price Per SF Land Net',
  'PropertyID',
  'Second Trust Deed Balance',
  'Transfer Tax',
]);

const DATE_COLUMNS = new Set([
  'Sale Date',
  'Publication Date',
  'Recording Date',
]);

const BOOLEAN_COLUMNS = new Set([
  'Has Lab Space',
]);

export function costarColumnType(column: string): CostarColumnType {
  if (NUMBER_COLUMNS.has(column)) return 'number';
  if (DATE_COLUMNS.has(column)) return 'date';
  if (BOOLEAN_COLUMNS.has(column)) return 'boolean';
  return 'text';
}
