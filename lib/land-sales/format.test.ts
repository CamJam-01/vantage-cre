import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { COSTAR_HEADERS } from './costar-fields.ts';
import { formatCatalogValue } from './format.ts';

describe('formatCatalogValue', () => {
  it('renders identifier-like numeric fields without grouping or numeric coercion', () => {
    const fields = [
      'Property Zip Code',
      'Assessed Year',
      'Document Number',
      'Parcel Number 1 (Min)',
      'Parcel Number 2 (Max)',
      'PropertyID',
    ];
    for (const field of fields) {
      assert.equal(formatCatalogValue(field, 9866427), '9866427', field);
      assert.equal(formatCatalogValue(field, '0012345'), '0012345', field);
    }
  });

  it('formats every Phone field as a North American phone number', () => {
    const phoneFields = [...new Set(COSTAR_HEADERS.filter(header => header.includes('Phone')))];
    assert.equal(phoneFields.length, 8);
    for (const field of phoneFields) {
      assert.equal(formatCatalogValue(field, '9195762500'), '(919) 576-2500', field);
      assert.equal(formatCatalogValue(field, '9,195,762,500'), '(919) 576-2500', field);
    }
  });

  it('handles a country code and extension while preserving unrecognized phone text', () => {
    assert.equal(formatCatalogValue('Buyer (True) Phone', '1-919-576-2500 x123'), '+1 (919) 576-2500 ext. 123');
    assert.equal(formatCatalogValue('Buyer (True) Phone', '+44 20 7946 0958'), '+44 20 7946 0958');
    assert.equal(formatCatalogValue('Buyer (True) Phone', 'Ask broker'), 'Ask broker');
  });

  it('rounds Land Area AC to two decimal places', () => {
    assert.equal(formatCatalogValue('Land Area AC', 1.5), '1.50');
    assert.equal(formatCatalogValue('Land Area AC', 12.345), '12.35');
    assert.equal(formatCatalogValue('Land Area AC', 1234), '1,234.00');
  });

  it('groups Land Area SF and land SF net/gross with commas', () => {
    assert.equal(formatCatalogValue('Land Area SF', 9866427), '9,866,427');
    assert.equal(formatCatalogValue('Land SF Gross', 1000000), '1,000,000');
    assert.equal(formatCatalogValue('Land SF Net', 50000), '50,000');
  });

  it('formats assessed and sale prices as whole-dollar USD', () => {
    assert.equal(formatCatalogValue('Assessed Value', 2350950), '$2,350,950');
    assert.equal(formatCatalogValue('Assessed Land', '331602'), '$331,602');
    assert.equal(formatCatalogValue('Assessed Improved', 1000), '$1,000');
    assert.equal(formatCatalogValue('Sale Price', 1250000), '$1,250,000');
    assert.equal(formatCatalogValue('Asking Price', 999999), '$999,999');
  });

  it('formats Sale Date as dd/mm/yyyy', () => {
    assert.equal(formatCatalogValue('Sale Date', '2025-08-14T00:00:00'), '14/08/2025');
    assert.equal(formatCatalogValue('Sale Date', '2024-03-02'), '02/03/2024');
  });

  it('preserves every stored decimal digit in per-unit price columns', () => {
    assert.equal(formatCatalogValue('Price Per SF Land', 10.25), '$10.25');
    assert.equal(formatCatalogValue('Price Per SF Land', '10.2500'), '$10.2500');
    assert.equal(formatCatalogValue('Price Per SF Land', '1234.56789'), '$1,234.56789');
    assert.equal(formatCatalogValue('Price Per AC Land', '250000.5'), '$250,000.5');
    assert.equal(formatCatalogValue('Price Per AC Land Net', '1000.25'), '$1,000.25');
    assert.equal(formatCatalogValue('Price Per SF Land Net', '12.5'), '$12.5');
  });
});
