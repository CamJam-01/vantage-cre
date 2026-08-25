'use client';

import { useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Blueprint } from '@/components/ui/blueprint';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Field } from '@/components/ui/field';
import { Tag } from '@/components/ui/tag';
import { PROPERTY_TYPES, US_STATES, type PropertyType } from '@/lib/land-sales/constants';
import { encodeFilters, type LandSaleFilters, type TimeFilter } from '@/lib/land-sales/search-params';
import { formatInputWithCommas, parseFormattedNumber } from '@/lib/land-sales/format';

type Tab = 'location' | 'type' | 'size' | 'time';

const TABS: { key: Tab; label: string }[] = [
  { key: 'location', label: 'Location' },
  { key: 'type', label: 'Type' },
  { key: 'size', label: 'Size' },
  { key: 'time', label: 'Time' },
];

const sectionStyle: CSSProperties = { padding: 'var(--space-6)', background: 'var(--color-neutral-100)' };
const modeRowStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'flex-start', flexDirection: 'row', gap: 20 };
const twoColStyle: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' };

export default function LandSalesSearchPage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>('location');
  const [sizeMode, setSizeMode] = useState<'sf' | 'ac'>('sf');
  const [timeMode, setTimeMode] = useState<'last' | 'range'>('last');

  const [state, setState] = useState('');
  const [msa, setMsa] = useState('');
  const [county, setCounty] = useState('');
  const [city, setCity] = useState('');
  const [types, setTypes] = useState<PropertyType[]>([]);
  const [sfMin, setSfMin] = useState('');
  const [sfMax, setSfMax] = useState('');
  const [acMin, setAcMin] = useState('');
  const [acMax, setAcMax] = useState('');

  const [lastDuration, setLastDuration] = useState('');
  const [lastUnit, setLastUnit] = useState<'months' | 'years'>('months');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  function toggleType(t: PropertyType) {
    setTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
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
      sfMin: sizeMode === 'sf' ? parseFormattedNumber(sfMin) : undefined,
      sfMax: sizeMode === 'sf' ? parseFormattedNumber(sfMax) : undefined,
      acMin: sizeMode === 'ac' ? parseFormattedNumber(acMin) : undefined,
      acMax: sizeMode === 'ac' ? parseFormattedNumber(acMax) : undefined,
      time,
    };
    router.push(`/land-sales?${encodeFilters(filters).toString()}`);
  }

  return (
    <main style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'var(--space-8) var(--space-6) calc(var(--space-8) * 2)', boxSizing: 'border-box',
      background: 'var(--color-accent-2-200)', paddingTop: 80,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 520 }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 36, fontWeight: 600, letterSpacing: '0.01em', color: 'var(--color-text)', margin: '0 0 var(--space-2)' }}>
          Land Sales Search
        </h1>
        <p style={{ fontSize: 15, color: 'var(--color-neutral-700)', margin: 0 }}>Refine your search using the criteria below.</p>
      </div>

      <Blueprint elevation="sm" style={{ position: 'relative', boxSizing: 'border-box', width: '100%', maxWidth: 640, marginTop: 'var(--space-8)' }}>

        <div style={{ display: 'flex', background: 'var(--color-accent-2-300)', borderBottom: '1px solid var(--color-neutral-300)' }}>
          {TABS.map(t => {
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                style={{
                  background: active ? 'var(--color-accent-600)' : 'transparent',
                  color: active ? '#FFFFFF' : 'var(--color-text)',
                  flex: 1, fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 600, letterSpacing: '0.02em',
                  padding: 'var(--space-4) var(--space-3)', cursor: 'pointer', border: 'none',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'location' && (
          <div style={{ ...sectionStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div className="field">
              <label htmlFor="state">State</label>
              <select id="state" className="input" value={state} onChange={e => setState(e.target.value)} style={{ backgroundColor: '#FFFFFF', cursor: 'pointer' }}>
                <option value="">Select state</option>
                {US_STATES.map(([code]) => <option key={code} value={code}>{code}</option>)}
              </select>
            </div>
            <Field id="msa" label="MSA" type="text" placeholder="e.g. New York–Newark–Jersey City" value={msa} onChange={e => setMsa(e.target.value)} style={{ backgroundColor: '#FFFFFF' }} />
            <Field id="county" label="County" type="text" placeholder="e.g. New York" value={county} onChange={e => setCounty(e.target.value)} style={{ backgroundColor: '#FFFFFF' }} />
            <Field id="city" label="City" type="text" placeholder="e.g. New York" value={city} onChange={e => setCity(e.target.value)} style={{ backgroundColor: '#FFFFFF' }} />
          </div>
        )}

        {activeTab === 'type' && (
          <div style={{ ...sectionStyle, display: 'grid', flexWrap: 'wrap', gap: 15, gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
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
                    cursor: 'pointer', fontSize: 14, fontWeight: 500, gap: 0, padding: 10,
                  }}
                >
                  {t}
                </Tag>
              );
            })}
          </div>
        )}

        {activeTab === 'size' && (
          <div style={{ ...sectionStyle, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={modeRowStyle}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
                {sizeMode === 'sf' ? 'Square Feet (SF)' : 'Acreage (AC)'}
              </span>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setSizeMode(m => m === 'sf' ? 'ac' : 'sf')}
                style={{ cursor: 'pointer', textAlign: 'left', alignSelf: 'auto', fontSize: 12, fontStyle: 'normal', textDecorationLine: 'underline' }}
              >
                {sizeMode === 'sf' ? 'Use Acreage' : 'Use Square Feet'}
              </button>
            </div>
            {sizeMode === 'sf' ? (
              <div style={twoColStyle}>
                <Field id="sfMin" label="Min" type="text" inputMode="numeric" placeholder="0" value={sfMin} onChange={e => setSfMin(formatInputWithCommas(e.target.value))} style={{ backgroundColor: '#FFFFFF' }} />
                <Field id="sfMax" label="Max" type="text" inputMode="numeric" placeholder="0" value={sfMax} onChange={e => setSfMax(formatInputWithCommas(e.target.value))} style={{ backgroundColor: '#FFFFFF' }} />
              </div>
            ) : (
              <div style={twoColStyle}>
                <Field id="acMin" label="Min" type="text" inputMode="decimal" placeholder="0.00" value={acMin} onChange={e => setAcMin(formatInputWithCommas(e.target.value))} style={{ backgroundColor: '#FFFFFF' }} />
                <Field id="acMax" label="Max" type="text" inputMode="decimal" placeholder="0.00" value={acMax} onChange={e => setAcMax(formatInputWithCommas(e.target.value))} style={{ backgroundColor: '#FFFFFF' }} />
              </div>
            )}
          </div>
        )}

        {activeTab === 'time' && (
          <div style={{ ...sectionStyle, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={modeRowStyle}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
                {timeMode === 'last' ? 'Last' : 'Range'}
              </span>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setTimeMode(m => m === 'last' ? 'range' : 'last')}
                style={{ cursor: 'pointer', textAlign: 'left', alignSelf: 'auto', fontSize: 12, fontStyle: 'normal', textDecorationLine: 'underline' }}
              >
                {timeMode === 'last' ? 'Use Range' : 'Use Last'}
              </button>
            </div>
            {timeMode === 'last' ? (
              <div style={{ ...twoColStyle, alignItems: 'end' }}>
                <Field id="lastDuration" label="Duration" type="number" placeholder="0" value={lastDuration} onChange={e => setLastDuration(e.target.value)} style={{ backgroundColor: '#FFFFFF' }} />
                <SegmentedControl
                  name="last-unit"
                  value={lastUnit}
                  onChange={v => setLastUnit(v as 'months' | 'years')}
                  options={[{ label: 'Months', value: 'months' }, { label: 'Years', value: 'years' }]}
                />
              </div>
            ) : (
              <div style={twoColStyle}>
                <Field id="dateFrom" label="From" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ backgroundColor: '#FFFFFF' }} />
                <Field id="dateTo" label="To" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ backgroundColor: '#FFFFFF' }} />
              </div>
            )}
          </div>
        )}

      </Blueprint>

      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: 640, marginTop: 'var(--space-6)' }}>
        <Link href="/search/sales" className="blueprint" style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4) var(--space-6)',
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
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4) var(--space-6)',
            background: 'var(--color-accent-600)', color: 'var(--color-bg)', border: 'none',
            cursor: 'pointer', boxShadow: 'var(--shadow-md)',
          }}
        >
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 600, letterSpacing: '0.03em' }}>CONTINUE</span>
          <ArrowRight size={18} strokeWidth={2} />
        </button>
      </div>
    </main>
  );
}
