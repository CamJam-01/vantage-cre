import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extrasFromFormData, EXTRAS_FIELD_PREFIX, landSaleInputSchema } from './schema.ts';

const core = {
  city: 'Wendell',
  county: 'Wake',
  state: 'NC',
  property_type: 'Land',
};

describe('landSaleInputSchema empty records', () => {
  it('accepts a completely empty payload', () => {
    const parsed = landSaleInputSchema.parse({});
    assert.equal(parsed.city, '');
    assert.equal(parsed.county, '');
    assert.equal(parsed.state, '');
    assert.equal(parsed.property_type, '');
    assert.equal(parsed.parcel_id, '');
    assert.equal(parsed.address, '');
    assert.equal(parsed.buyer, '');
    assert.equal(parsed.acreage, undefined);
    assert.equal(parsed.sale_price, undefined);
    assert.equal(parsed.sale_date, undefined);
  });

  it('accepts blank strings from an empty form or CSV row', () => {
    const parsed = landSaleInputSchema.parse({
      parcel_id: '',
      address: '',
      city: '',
      county: '',
      state: '',
      msa: '',
      property_type: '',
      square_feet: '',
      acreage: '',
      sale_date: '',
      sale_price: '',
      buyer: '',
    });
    assert.equal(parsed.city, '');
    assert.equal(parsed.state, '');
    assert.equal(parsed.property_type, '');
    assert.equal(parsed.acreage, undefined);
    assert.equal(parsed.sale_date, undefined);
  });

  it('still rejects a present but invalid state code', () => {
    const parsed = landSaleInputSchema.safeParse({ ...core, state: 'N' });
    assert.equal(parsed.success, false);
  });
});

describe('landSaleInputSchema extras', () => {
  it('defaults extras to an empty object when omitted', () => {
    const parsed = landSaleInputSchema.parse(core);
    assert.deepEqual(parsed.extras, {});
  });

  it('keeps custom field values keyed by their CSV header', () => {
    const parsed = landSaleInputSchema.parse({
      ...core,
      extras: { Zoning: 'RA', Market: 'Raleigh, NC' },
    });
    assert.deepEqual(parsed.extras, { Zoning: 'RA', Market: 'Raleigh, NC' });
  });
});

describe('extrasFromFormData', () => {
  it('reads extra: prefixed fields and omits blanks', () => {
    const form = new FormData();
    form.set(`${EXTRAS_FIELD_PREFIX}Zoning`, 'RA');
    form.set(`${EXTRAS_FIELD_PREFIX}Market`, '  ');
    form.set('city', 'Wendell');
    assert.deepEqual(extrasFromFormData(form), { Zoning: 'RA' });
  });

  it('returns empty when the form has no extra fields', () => {
    const form = new FormData();
    form.set('city', 'Wendell');
    assert.deepEqual(extrasFromFormData(form), {});
  });
});
