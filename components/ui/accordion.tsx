'use client';

import { ChevronDown } from 'lucide-react';
import { type CSSProperties, type ReactNode } from 'react';

type AccordionHeaderProps = {
  title: ReactNode;
  open: boolean;
  onToggle: () => void;
  style: CSSProperties;
  titleStyle: CSSProperties;
  chevronSize?: number;
};

/** Just the clickable header row (label + rotating chevron) — deliberately low-level.
 * Each section in LandSalesSearch has different padding/background/border, so the
 * wrapper, header and content styles are supplied by the caller rather than inferred
 * from a generic "nested" flag. */
export function AccordionHeader({ title, open, onToggle, style, titleStyle, chevronSize = 18 }: AccordionHeaderProps) {
  return (
    <div
      onClick={onToggle}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', ...style }}
    >
      <span style={titleStyle}>{title}</span>
      <ChevronDown
        size={chevronSize}
        strokeWidth={1.5}
        color="var(--color-accent-700)"
        style={{ transition: 'transform 0.15s ease', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}
      />
    </div>
  );
}
