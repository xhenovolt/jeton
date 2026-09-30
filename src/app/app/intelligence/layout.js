'use client';

/**
 * Intelligence hub layout — every analytics view lives under
 * /app/intelligence/* and shares one tab bar (see SectionTabs).
 */

import { getSectionTabs } from '@/lib/navigation-config';
import { SectionTabs } from '@/components/layout/SectionTabs';

const TABS = getSectionTabs('intelligence');

export default function IntelligenceLayout({ children }) {
  return (
    <div>
      <SectionTabs tabs={TABS} rootHref="/app/intelligence" label="Intelligence sections" />
      {children}
    </div>
  );
}
