'use client';

import { useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Blueprint } from '@/components/ui/blueprint';
import { AccordionHeader } from '@/components/ui/accordion';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Field } from '@/components/ui/field';
import { Tag } from '@/components/ui/tag';
import { PROPERTY_TYPES, US_STATES, type PropertyType } from '@/lib/land-sales/constants';
import { encodeFilters, type LandSaleFilters, type TimeFilter } from '@/lib/land-sales/search-params';

function formatWithCommas(raw: string): string {
  let clean = raw.replace(/[^0-9.]/g, '');
  const firstDot = clean.indexOf('.');
  if (firstDot !== -1) clean = clean.slice(0, firstDot + 1) + clean.slice(firstDot + 1).replace(/\./g, '');
  const [intPart, decPart] = clean.split('.');
  const withCommas = (intPart || '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decPart !== undefined ? `${withCommas}.${decPart}` : withCommas;
}

function parseNum(formatted: string): number | undefined {
  const n = Number(formatted.replace(/,/g, ''));
  return formatted && Number.isFinite(n) ? n : undefined;
}

// Effective computed styles from the mockup (LandSalesSearch.dc.html): several
// declarations there reference --space-5/--space-7, which the design system's
// token sheet never defines — that makes the whole shorthand `padding` invalid,
// so only the explicit px longhands (or nothing, where none exist) actually apply.
const topHeaderStyle: CSSProperties = { padding: 'var(--space-4) var(--space-6)', background: 'var(--color-accent-200)' };
const topTitleStyle: CSSProperties = { fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 600, color: 'var(--color-text)' };
const nestedHeaderBase: CSSProperties = { padding: '15px 20px 5px 20px' };
const nestedTitleStyle: CSSProperties = { fontSize: 14, fontWeight: 500, color: 'var(--color-text)' };
const nestedContentStyle: CSSProperties = { padding: '0 20px 13.6px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' };

export default function LandSalesSearchPage() {
  const router = useRouter();

  const [locationOpen, setLocationOpen] = useState(true);
  const [typeOpen, setTypeOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [sfOpen, setSfOpen] = useState(false);
  const [acOpen, setAcOpen] = useState(false);
  const [lastOpen, setLastOpen] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);

  const [state, setState] = useState('');
  const [msa, setMsa] = useState('');
  const [county, setCounty] = useState('');
  const [city, setCity] = useState('');
  const [types, setTypes] = useState<PropertyType[]>([]);
  const [sfMin, setSfMin] = useState('');
  const [sfMax, setSfMax] = useState('');
  const [acMin, setAcMin] = useState('');
  const [acMax, setAcMax] = useState('');

  const [timeMode, setTimeMode] = useState<'none' | 'last' | 'range'>('none');
  const [lastDuration, setLastDuration] = useState('');
  const [lastUnit, setLastUnit] = useState<'months' | 'years'>('months');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  function toggleType(t: PropertyType) {
    setTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }

  function setLastDurationValue(v: string) {
    setLastDuration(v);
    setTimeMode(v ? 'last' : 'none');
    setDateFrom(''); setDateTo('');
  }

  function setDateRangeValue(which: 'from' | 'to', v: string) {
    if (which === 'from') setDateFrom(v); else setDateTo(v);
    setTimeMode('range');
    setLastDuration('');
  }

  function handleContinue() {
    let time: TimeFilter | undefined;
    if (timeMode === 'last' && lastDuration) {
      time = { mode: 'last', duration: Number(lastDuration), unit: lastUnit };
    } else if (timeMode === 'range' && (dateFrom || dateTo)) {
      time = { mode: 'range', from: dateFrom || undefined, to: dateTo || undefined };
    }
    const filters: LandSaleFilters = {
      state: state || undefined,
      msa: msa.trim() || undefined,
      county: county.trim() || undefined,
      city: city.trim() || undefined,
      types,
      sfMin: parseNum(sfMin),
      sfMax: parseNum(sfMax),
      acMin: parseNum(acMin),
      acMax: parseNum(acMax),
      time,
    };
    router.push(`/land-sales?${encodeFilters(filters).toString()}`);
  }

  return (
    <main style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'var(--space-8) var(--space-6) calc(var(--space-8) * 2)', boxSizing: 'border-box',
      background: 'var(--color-accent-2-100)', paddingTop: 80,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 520 }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 36, fontWeight: 600, letterSpacing: '0.01em', color: 'var(--color-text)', margin: '0 0 var(--space-2)' }}>
          Land Sales Search
        </h1>
        <p style={{ fontSize: 15, color: 'var(--color-neutral-700)', margin: 0 }}>Refine your search using the criteria below.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', width: '100%', maxWidth: 640, marginTop: 'var(--space-8)' }}>

        {/* Location */}
        <Blueprint elevation="sm">
          <AccordionHeader title="Location" open={locationOpen} onToggle={() => setLocationOpen(o => !o)} style={topHeaderStyle} titleStyle={topTitleStyle} />
          {locationOpen && (
            <div style={{
              padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)',
              background: 'var(--color-accent-2-100)', border: '1px solid var(--color-neutral-300)',
            }}>
              <div className="field">
                <label htmlFor="state">State</label>
                <select id="state" className="input" value={state} onChange={e => setState(e.target.value)} style={{ backgroundColor: '#FFFFFF' }}>
                  <option value="">Any state</option>
                  {US_STATES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                </select>
              </div>
              <Field id="msa" label="MSA" type="text" placeholder="e.g. Dallas-Fort Worth" value={msa} onChange={e => setMsa(e.target.value)} style={{ backgroundColor: '#FFFFFF' }} />
              <Field id="county" label="County" type="text" placeholder="e.g. Denton" value={county} onChange={e => setCounty(e.target.value)} style={{ backgroundColor: '#FFFFFF' }} />
              <Field id="city" label="City" type="text" placeholder="e.g. Denton" value={city} onChange={e => setCity(e.target.value)} style={{ backgroundColor: '#FFFFFF' }} />
            </div>
          )}
        </Blueprint>

        {/* Type */}
        <Blueprint elevation="sm">
          <AccordionHeader title="Type" open={typeOpen} onToggle={() => setTypeOpen(o => !o)} style={topHeaderStyle} titleStyle={topTitleStyle} />
          {typeOpen && (
            <div style={{
              padding: 20, display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)',
              background: 'var(--color-accent-100)', border: '1px solid var(--color-neutral-300)',
            }}>
              {PROPERTY_TYPES.map(t => {
                const selected = types.includes(t);
                return (
                  <Tag
                    key={t}
                    onClick={() => toggleType(t)}
                    style={{
                      background: selected ? 'var(--color-accent-600)' : '#FFFFFF',
                      color: selected ? '#FFFFFF' : 'var(--color-neutral-900)',
                      border: `1px solid ${selected ? 'var(--color-accent-600)' : 'var(--color-neutral-400)'}`,
                      cursor: 'pointer',
                    }}
                  >
                    {t}
                  </Tag>
                );
              })}
            </div>
          )}
        </Blueprint>

        {/* Size */}
        <Blueprint elevation="sm">
          <AccordionHeader title="Size" open={sizeOpen} onToggle={() => setSizeOpen(o => !o)} style={topHeaderStyle} titleStyle={topTitleStyle} />
          {sizeOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ borderTop: '1px solid var(--color-neutral-300)' }}>
                <AccordionHeader
                  title="Square Feet (SF)" open={sfOpen} onToggle={() => setSfOpen(o => !o)}
                  style={{ ...nestedHeaderBase, background: 'var(--color-accent-2-100)' }} titleStyle={nestedTitleStyle} chevronSize={16}
                />
                {sfOpen && (
                  <div style={nestedContentStyle}>
                    <Field id="sfMin" label="Min" type="text" inputMode="numeric" placeholder="0" value={sfMin} onChange={e => setSfMin(formatWithCommas(e.target.value))} style={{ backgroundColor: '#FFFFFF' }} />
                    <Field id="sfMax" label="Max" type="text" inputMode="numeric" placeholder="0" value={sfMax} onChange={e => setSfMax(formatWithCommas(e.target.value))} style={{ backgroundColor: '#FFFFFF' }} />
                  </div>
                )}
              </div>
              <div style={{ borderTop: '1px solid var(--color-neutral-300)', paddingBottom: 10 }}>
                <AccordionHeader
                  title="Acreage (AC)" open={acOpen} onToggle={() => setAcOpen(o => !o)}
                  style={nestedHeaderBase} titleStyle={nestedTitleStyle} chevronSize={16}
                />
                {acOpen && (
                  <div style={nestedContentStyle}>
                    <Field id="acMin" label="Min" type="text" inputMode="decimal" placeholder="0.00" value={acMin} onChange={e => setAcMin(formatWithCommas(e.target.value))} style={{ backgroundColor: '#FFFFFF' }} />
                    <Field id="acMax" label="Max" type="text" inputMode="decimal" placeholder="0.00" value={acMax} onChange={e => setAcMax(formatWithCommas(e.target.value))} style={{ backgroundColor: '#FFFFFF' }} />
                  </div>
                )}
              </div>
            </div>
          )}
        </Blueprint>

        {/* Time */}
        <Blueprint elevation="sm">
          <AccordionHeader title="Time" open={timeOpen} onToggle={() => setTimeOpen(o => !o)} style={topHeaderStyle} titleStyle={topTitleStyle} />
          {timeOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ borderTop: '1px solid var(--color-neutral-300)' }}>
                <AccordionHeader
                  title="Last" open={lastOpen} onToggle={() => setLastOpen(o => !o)}
                  style={nestedHeaderBase} titleStyle={nestedTitleStyle} chevronSize={16}
                />
                {lastOpen && (
                  <div style={{ ...nestedContentStyle, alignItems: 'end' }}>
                    <Field
                      id="lastDuration" label="Duration" type="number" placeholder="0"
                      value={lastDuration} onChange={e => setLastDurationValue(e.target.value)}
                      style={{ backgroundColor: '#FFFFFF' }}
                    />
                    <SegmentedControl
                      name="last-unit"
                      value={lastUnit}
                      onChange={v => setLastUnit(v as 'months' | 'years')}
                      options={[{ label: 'Months', value: 'months' }, { label: 'Years', value: 'years' }]}
                    />
                  </div>
                )}
                {timeMode === 'range' && <p style={{ fontSize: 12, color: 'var(--color-neutral-600)', margin: '0 20px var(--space-2)' }}>Clears the date Range below.</p>}
              </div>
              <div style={{ borderTop: '1px solid var(--color-neutral-300)', paddingBottom: 10 }}>
                <AccordionHeader
                  title="Range" open={rangeOpen} onToggle={() => setRangeOpen(o => !o)}
                  style={nestedHeaderBase} titleStyle={nestedTitleStyle} chevronSize={16}
                />
                {rangeOpen && (
                  <div style={nestedContentStyle}>
                    <Field id="dateFrom" label="From" type="date" value={dateFrom} onChange={e => setDateRangeValue('from', e.target.value)} style={{ backgroundColor: '#FFFFFF' }} />
                    <Field id="dateTo" label="To" type="date" value={dateTo} onChange={e => setDateRangeValue('to', e.target.value)} style={{ backgroundColor: '#FFFFFF' }} />
                  </div>
                )}
                {timeMode === 'last' && <p style={{ fontSize: 12, color: 'var(--color-neutral-600)', margin: '0 20px var(--space-2)' }}>Clears &quot;Last&quot; above.</p>}
              </div>
            </div>
          )}
        </Blueprint>

      </div>

      <Link href="/search/sales" className="blueprint" style={{
        position: 'fixed', bottom: 'var(--space-6)', left: 'var(--space-6)', display: 'flex',
        alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4) var(--space-6)',
        background: 'var(--color-bg)', color: 'var(--color-text)', boxShadow: 'var(--shadow-md)', textDecoration: 'none',
      }}>
        <ArrowLeft size={18} strokeWidth={2} />
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 600, letterSpacing: '0.03em' }}>BACK</span>
      </Link>

      <button
        type="button"
        className="blueprint"
        onClick={handleContinue}
        style={{
          position: 'fixed', bottom: 'var(--space-6)', right: 'var(--space-6)', display: 'flex',
          alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4) var(--space-6)',
          background: 'var(--color-accent-600)', color: 'var(--color-bg)', border: 'none',
          cursor: 'pointer', boxShadow: 'var(--shadow-md)',
        }}
      >
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 600, letterSpacing: '0.03em' }}>CONTINUE</span>
        <ArrowRight size={18} strokeWidth={2} />
      </button>
    </main>
  );
}
