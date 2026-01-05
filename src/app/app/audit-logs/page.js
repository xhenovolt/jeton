'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Download, Filter, Search } from 'lucide-react';

/**
 * Audit Logs Page
 * View system audit trail and activity logs
 */
export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      // Placeholder for fetching audit logs
      setLogs([
        {
          id: 1,
          action: 'Asset Created',
          actor: 'Admin User',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          details: 'Created MacBook Pro asset',
          status: 'success',
        },
        {
          id: 2,
          action: 'IP Updated',
          actor: 'Admin User',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          details: 'Updated Jeton Platform valuation',
          status: 'success',
        },
      ]);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    return status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  if (loading) {
    return <div className="p-6">Loading audit logs...</div>;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Audit Logs</h1>
            <p className="text-muted-foreground">System activity and changes history</p>
          </div>
          <button className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90">
            <Download size={20} /> Export
          </button>
        </div>

        {/* Filters */}
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-muted-foreground" size={20} />
              <input
                type="text"
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button className="flex items-center justify-center gap-2 border border-border rounded-lg px-4 py-2 hover:bg-muted">
              <Filter size={20} /> Filter
            </button>
          </div>
        </div>

        {/* Logs Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Action</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Actor</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Timestamp</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Details</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-muted-foreground">
                      No audit logs found
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="border-b border-border hover:bg-muted/30">
                      <td className="px-6 py-4 font-medium text-foreground">{log.action}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{log.actor}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{log.details}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(log.status)}`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
