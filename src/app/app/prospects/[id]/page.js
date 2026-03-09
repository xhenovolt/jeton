'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Mail, Phone, Globe, Calendar, Users, Building2, Edit3, Trash2, UserCheck } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { formatCurrency } from '@/lib/format-currency';
import Link from 'next/link';

const STAGE_COLORS = {
  new: 'bg-muted text-foreground', contacted: 'bg-blue-100 text-blue-700', qualified: 'bg-cyan-100 text-cyan-700',
  proposal: 'bg-purple-100 text-purple-700', negotiation: 'bg-orange-100 text-orange-700',
  won: 'bg-emerald-100 text-emerald-700', lost: 'bg-red-100 text-red-700', dormant: 'bg-muted text-muted-foreground',
};

export default function ProspectDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [prospect, setProspect] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});

  useEffect(() => { fetchProspect(); }, [id]);

  const fetchProspect = async () => {
    try {
      const res = await fetchWithAuth(`/api/prospects/${id}`);
      const json = await res.json();
      if (json.success) { setProspect(json.data); setForm(json.data); }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const updateProspect = async (updates) => {
    try {
      const res = await fetchWithAuth(`/api/prospects/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const json = await res.json();
      if (json.success) { setProspect(json.data); setEditing(false); }
    } catch (err) { console.error(err); }
  };

  const convertToClient = async () => {
    if (!confirm('Convert this prospect to a client?')) return;
    try {
      const res = await fetchWithAuth(`/api/prospects/${id}/convert`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      const json = await res.json();
      if (json.success) { alert('Prospect converted to client!'); router.push(`/app/clients/${json.data.id}`); }
      else alert(json.error);
    } catch (err) { console.error(err); }
  };

  const deleteProspect = async () => {
    if (!confirm('Delete this prospect? This cannot be undone.')) return;
    try {
      const res = await fetchWithAuth(`/api/prospects/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) router.push('/app/prospects');
    } catch (err) { console.error(err); }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  if (!prospect) return <div className="p-6 text-center text-muted-foreground">Prospect not found</div>;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <Link href="/app/prospects" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" /> Back to Prospects</Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{prospect.company_name}</h1>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STAGE_COLORS[prospect.stage]}`}>{prospect.stage}</span>
          </div>
          {prospect.contact_name && <p className="text-muted-foreground mt-1">{prospect.contact_name}</p>}
        </div>
        <div className="flex gap-2">
          {prospect.stage !== 'won' && prospect.stage !== 'lost' && (
            <button onClick={convertToClient} className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-emerald-700"><UserCheck className="w-4 h-4" /> Convert to Client</button>
          )}
          <button onClick={() => setEditing(!editing)} className="p-2 rounded-lg border hover:bg-muted"><Edit3 className="w-4 h-4 text-muted-foreground" /></button>
          <button onClick={deleteProspect} className="p-2 rounded-lg border hover:bg-red-50"><Trash2 className="w-4 h-4 text-red-500" /></button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border p-5 space-y-3">
          <h3 className="font-semibold text-foreground">Contact Information</h3>
          {prospect.email && <div className="flex items-center gap-2 text-sm"><Mail className="w-4 h-4 text-muted-foreground" />{prospect.email}</div>}
          {prospect.phone && <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-muted-foreground" />{prospect.phone}</div>}
          {prospect.website && <div className="flex items-center gap-2 text-sm"><Globe className="w-4 h-4 text-muted-foreground" /><a href={prospect.website} target="_blank" className="text-blue-600 hover:underline">{prospect.website}</a></div>}
          {prospect.industry && <div className="flex items-center gap-2 text-sm"><Building2 className="w-4 h-4 text-muted-foreground" />{prospect.industry}</div>}
        </div>

        <div className="bg-card rounded-xl border p-5 space-y-3">
          <h3 className="font-semibold text-foreground">Details</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-muted-foreground">Source:</span><span className="capitalize">{prospect.source || 'N/A'}</span>
            <span className="text-muted-foreground">Priority:</span><span className="capitalize">{prospect.priority}</span>
            <span className="text-muted-foreground">Est. Value:</span><span>{prospect.estimated_value ? formatCurrency(prospect.estimated_value) : 'N/A'}</span>
            <span className="text-muted-foreground">Next Follow-up:</span><span>{prospect.next_followup_date ? new Date(prospect.next_followup_date).toLocaleDateString() : 'None'}</span>
          </div>
        </div>
      </div>

      {/* Stage Update */}
      {editing && (
        <div className="bg-card rounded-xl border p-5 space-y-4">
          <h3 className="font-semibold text-foreground">Update Stage</h3>
          <div className="flex flex-wrap gap-2">
            {['new','contacted','qualified','proposal','negotiation','won','lost','dormant'].map(s => (
              <button key={s} onClick={() => updateProspect({ stage: s })}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${prospect.stage === s ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-gray-200'}`}>{s}</button>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {prospect.notes && (
        <div className="bg-card rounded-xl border p-5">
          <h3 className="font-semibold text-foreground mb-2">Notes</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{prospect.notes}</p>
        </div>
      )}

      {/* Contacts */}
      <div className="bg-card rounded-xl border p-5">
        <h3 className="font-semibold text-foreground mb-3">Contacts ({(prospect.contacts || []).length})</h3>
        {(prospect.contacts || []).length === 0 ? (
          <p className="text-muted-foreground text-sm">No contacts added yet</p>
        ) : (
          <div className="space-y-2">
            {prospect.contacts.map(c => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <span className="text-sm font-medium">{c.name}</span>
                  {c.title && <span className="text-xs text-muted-foreground ml-2">{c.title}</span>}
                  {c.is_primary && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Primary</span>}
                </div>
                <div className="text-xs text-muted-foreground">{c.email} {c.phone}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Follow-ups */}
      <div className="bg-card rounded-xl border p-5">
        <h3 className="font-semibold text-foreground mb-3">Follow-ups ({(prospect.followups || []).length})</h3>
        {(prospect.followups || []).length === 0 ? (
          <p className="text-muted-foreground text-sm">No follow-ups yet</p>
        ) : (
          <div className="space-y-2">
            {prospect.followups.map(f => (
              <div key={f.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <span className="text-sm font-medium capitalize">{f.type}</span>
                  <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${f.status === 'completed' ? 'bg-green-100 text-green-700' : f.status === 'scheduled' ? 'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground'}`}>{f.status}</span>
                  {f.summary && <span className="text-xs text-muted-foreground ml-2">{f.summary}</span>}
                </div>
                <span className="text-xs text-muted-foreground">{new Date(f.scheduled_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
