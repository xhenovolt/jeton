// Jeton Design System Viewer UI
import { templates } from '@/lib/design-system/templates';
import { shapes2D, shapes3D } from '@/lib/design-system/shapes';
import { useState } from 'react';

export default function DesignsPage() {
  const [filter, setFilter] = useState('all');
  const filtered = filter === 'all' ? templates : templates.filter(t => t.type === filter);
  const categories = ['all', ...Array.from(new Set(templates.map(t => t.type)))];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Jeton Design System</h1>
      <div className="mb-4 flex gap-2">
        {categories.map(cat => (
          <button key={cat} className={`px-3 py-1 rounded ${filter===cat?'bg-green-600 text-white':'bg-gray-200'}`} onClick={()=>setFilter(cat)}>{cat}</button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {filtered.map(t => (
          <div key={t.id} className="bg-white rounded shadow p-4 flex flex-col items-center">
            <TemplatePreview template={t} />
            <div className="mt-2 font-semibold">{t.name}</div>
            <button className="mt-2 px-4 py-1 bg-green-600 text-white rounded" onClick={()=>downloadTemplate(t, 'svg')}>Download SVG</button>
            <button className="mt-1 px-4 py-1 bg-blue-600 text-white rounded" onClick={()=>downloadTemplate(t, 'png')}>Download PNG</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TemplatePreview({ template }) {
  // For now, render a placeholder SVG preview
  return (
    <svg width="160" height="160" viewBox="0 0 160 160" style={{background:'linear-gradient(135deg,#eee,#fff)'}}>
      <rect x="0" y="0" width="160" height="160" rx="16" fill="#f3f3f3" />
      {/* TODO: Render layers from template */}
      <text x="50%" y="50%" textAnchor="middle" fill="#888" fontSize="16" dy=".3em">{template.name}</text>
    </svg>
  );
}

function downloadTemplate(template, type) {
  // TODO: Implement SVG/PNG export
  alert(`Download ${template.name} as ${type} coming soon!`);
}
