'use client';

import { OptionPicker } from '@/components/land-sales/option-picker';

const OPTIONS = [
  { key: 'sales', label: 'Sales' },
  { key: 'rentals', label: 'Rentals', disabled: true },
  { key: 'expenses', label: 'Expenses', disabled: true },
  { key: 'costs', label: 'Costs', disabled: true },
];

const DESTINATIONS: Record<string, string> = {
  sales: '/search/sales',
};

export default function SearchPage() {
  return (
    <OptionPicker
      title="Start a New Search"
      subtitle="Choose a category to begin building your search."
      options={OPTIONS}
      continueHref={key => DESTINATIONS[key] ?? '/search'}
    />
  );
}
