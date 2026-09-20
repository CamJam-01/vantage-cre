'use client';

import { OptionPicker } from '@/components/land-sales/option-picker';

const OPTIONS = [
  { key: 'land', label: 'Land' },
  { key: 'improved', label: 'Improved' },
  { key: 'ground-leases', label: 'Ground Leases', disabled: true },
];

const DESTINATIONS: Record<string, string> = {
  land: '/search/sales/land',
  improved: '/search/sales/improved',
};

export default function SalesSearchPage() {
  return (
    <OptionPicker
      title="Sales Search"
      subtitle="Choose a property type to continue."
      options={OPTIONS}
      backHref="/search"
      continueHref={key => DESTINATIONS[key] ?? '/search/sales'}
    />
  );
}
