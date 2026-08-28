import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DOCX_MIME_TYPE,
  DOCX_TEMPLATE_MAX_BYTES,
  mergedFileName,
  templateNameError,
  templateObjectPath,
  validateTemplateFile,
} from './docx-templates.ts';

describe('validateTemplateFile', () => {
  const docx = { name: 'Narrative.docx', size: 20_000, type: DOCX_MIME_TYPE };

  it('accepts a .docx', () => {
    assert.equal(validateTemplateFile(docx), null);
  });

  it('accepts a .docx the browser could not identify', () => {
    // Windows without Office installed reports exactly this.
    assert.equal(validateTemplateFile({ ...docx, type: 'application/octet-stream' }), null);
    assert.equal(validateTemplateFile({ ...docx, type: '' }), null);
  });

  it('rejects other Word formats by extension', () => {
    assert.equal(validateTemplateFile({ ...docx, name: 'Narrative.doc' }), 'type');
    assert.equal(validateTemplateFile({ ...docx, name: 'Narrative.dotx' }), 'type');
  });

  it('rejects a file whose MIME type contradicts the extension', () => {
    assert.equal(validateTemplateFile({ ...docx, type: 'application/pdf' }), 'type');
  });

  it('rejects an empty or absent file', () => {
    assert.equal(validateTemplateFile(null), 'missing');
    assert.equal(validateTemplateFile({ ...docx, size: 0 }), 'missing');
  });

  it('rejects a file over the size ceiling', () => {
    assert.equal(validateTemplateFile({ ...docx, size: DOCX_TEMPLATE_MAX_BYTES + 1 }), 'size');
    assert.equal(validateTemplateFile({ ...docx, size: DOCX_TEMPLATE_MAX_BYTES }), null);
  });
});

describe('templateNameError', () => {
  it('requires a name', () => {
    assert.equal(typeof templateNameError('   '), 'string');
    assert.equal(templateNameError('Land Comp Narrative'), null);
  });

  it('caps the length', () => {
    assert.equal(typeof templateNameError('x'.repeat(81)), 'string');
    assert.equal(templateNameError('x'.repeat(80)), null);
  });
});

describe('templateObjectPath', () => {
  it('keys storage by row id, so a rename never moves a file', () => {
    assert.equal(templateObjectPath('0f8b-1'), '0f8b-1.docx');
  });
});

describe('mergedFileName', () => {
  it('names the download after the template and record count', () => {
    assert.equal(mergedFileName('Land Comp Narrative', 5), 'land-comp-narrative-5-records.docx');
    assert.equal(mergedFileName('Land Comp Narrative', 1), 'land-comp-narrative-1-record.docx');
  });

  it('strips characters a Content-Disposition header could not carry', () => {
    const name = mergedFileName('Q3 "Draft" / Final', 2);
    assert.equal(name, 'q3-draft-final-2-records.docx');
    assert.equal(/^[a-z0-9-]+\.docx$/.test(name), true);
  });

  it('still produces a filename when the name has nothing usable in it', () => {
    assert.equal(mergedFileName('•••', 1), 'merge-1-record.docx');
  });
});
