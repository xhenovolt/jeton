'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Building2, Mail, Phone, Globe, Handshake, DollarSign, Plus } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import Link from 'next/link';

export default function ClientDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchClient(); }, [id]);

  const fetchClient = async () => {
    try {
      const res = await fetchWithAuth(`/api/clients/${id}`);
      const json = await res.json();
      if (json.success) setClient(json.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  if (!client) return <div className="p-6 text-center text-gray-500">Client not found</div>;

  const deals = client.deals || [];

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <Link href="/app/clients" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="w-4 h-4" /> Back to Clients</Link>

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center"><Building2 className="w-6 h-6 text-blue-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{client.company_name}</h1>
            {client.contact_name && <p className="text-gray-500">{client.contact_name}</p>}
          </div>
        </div>
        <Link href={`/app/deals/new?client_id=${id}`} className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700">
          <Plus className="w-4 h-4" /> New Deal
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Total Deal Value</div>
          <div className="text-xl font-bold text-gray-900">${parseFloat(client.total_deal_value || 0).toLocaleString()}</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Total Paid</div>
          <div className="text-xl font-bold text-emerald-600">${parseFloat(client.total_paid || 0).toLocaleString()}</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Deals</div>
          <div className="text-xl font-bold text-gray-900">{deals.length}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h3 className="font-semibold text-gray-900">Contact</h3>
          {client.email && <div className="flex items-center gap-2 text-sm"><Mail className="w-4 h-4 text-gray-400" />{client.email}</div>}
          {client.phone && <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-gray-400" />{client.phone}</div>}
          {client.website && <div className="flex items-center gap-2 text-sm"><Globe className="w-4 h-4 text-gray-400" />{client.website}</div>}
          {client.billing_address && <div className="text-sm text-gray-600 mt-2">{client.billing_address}</div>}
        </div>
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h3 className="font-semibold text-gray-900">Details</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-gray-500">Industry:</span><span>{client.industry || 'N/A'}</span>
            <span className="text-gray-500">Payment Terms:</span><span>{client.payment_terms} days</span>
            <span className="text-gray-500">Currency:</span><span>{client.preferred_currency}</span>
            <span className="text-gray-500">Status:</span><span className="capitalize">{client.status}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Deals ({deals.length})</h3>
        {deals.length === 0 ? (
          <p className="text-gray-400 text-sm">No deals yet</p>
        ) : (
          <div className="divide-y">
            {deals.map(d => (
              <Link key={d.id} href={`/app/deals/${d.id}`} className="flex items-center justify-between py-3 hover:bg-gray-50 px-2 rounded">
                <div>
                  <span className="text-sm font-medium">{d.title}</span>
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded-full capitalize ${d.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{d.status}</span>
                </div>
                <span className="text-sm font-medium">${parseFloat(d.total_amount).toLocaleString()}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
