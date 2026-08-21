import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extrasFromFormData, EXTRAS_FIELD_PREFIX, landSaleInputSchema } from './schema.ts';

const core = {
  city: 'Wendell',
  county: 'Wake',
  state: 'NC',
  property_type: 'Land',
};

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
