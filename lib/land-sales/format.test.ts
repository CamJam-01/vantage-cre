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

  it('continues grouping numeric quantities', () => {
    assert.equal(formatCatalogValue('Land Area SF', 9866427), '9,866,427');
  });

  it('formats assessed value and land as whole-dollar USD', () => {
    assert.equal(formatCatalogValue('Assessed Value', 2350950), '$2,350,950');
    assert.equal(formatCatalogValue('Assessed Land', '331602'), '$331,602');
  });

  it('preserves every stored decimal digit in Price Per SF Land', () => {
    assert.equal(formatCatalogValue('Price Per SF Land', 10.25), '$10.25');
    assert.equal(formatCatalogValue('Price Per SF Land', '10.2500'), '$10.2500');
    assert.equal(formatCatalogValue('Price Per SF Land', '1234.56789'), '$1,234.56789');
  });
});
