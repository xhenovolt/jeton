'use client';

/**
 * People section layout — Directory, Departments & HRM, Payroll and Org
 * Hierarchy all live under /app/staff/* and share one tab bar.
 */

import { getSectionTabs } from '@/lib/navigation-config';
import { SectionTabs } from '@/components/layout/SectionTabs';

const TABS = getSectionTabs('staff');

export default function StaffLayout({ children }) {
  return (
    <div>
      <SectionTabs tabs={TABS} rootHref="/app/staff" label="People sections" />
      {children}
    </div>
  );
}
