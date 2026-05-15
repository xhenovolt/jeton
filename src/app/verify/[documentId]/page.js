'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function VerificationPage() {
  const params = useParams();
  const documentId = params?.documentId;
  const [status, setStatus] = useState('loading');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!documentId) return;

    const verifyDocument = async () => {
      try {
        const response = await fetch(`/api/documents/verify?id=${encodeURIComponent(documentId)}`);
        const result = await response.json();

        if (result.success) {
          setStatus('verified');
          setData(result.data);
        } else {
          setStatus(result.status || 'error');
          setError(result.error);
          setData(result.data);
        }
      } catch (err) {
        setStatus('error');
        setError('Failed to verify document: ' + err.message);
      }
    };

    verifyDocument();
  }, [documentId]);

  const statusConfig = {
    loading: {
      icon: '⏳',
      title: 'Verifying Document...',
      color: 'bg-blue-50 border-blue-200',
      textColor: 'text-blue-900',
      bgColor: 'bg-blue-100',
    },
    verified: {
      icon: '✓',
      title: 'Document Verified',
      color: 'bg-green-50 border-green-200',
      textColor: 'text-green-900',
      bgColor: 'bg-green-100',
    },
    revoked: {
      icon: '⚠',
      title: 'Document Revoked',
      color: 'bg-red-50 border-red-200',
      textColor: 'text-red-900',
      bgColor: 'bg-red-100',
    },
    expired: {
      icon: '⏰',
      title: 'Document Expired',
      color: 'bg-yellow-50 border-yellow-200',
      textColor: 'text-yellow-900',
      bgColor: 'bg-yellow-100',
    },
    not_found: {
      icon: '❌',
      title: 'Document Not Found',
      color: 'bg-red-50 border-red-200',
      textColor: 'text-red-900',
      bgColor: 'bg-red-100',
    },
    error: {
      icon: '❌',
      title: 'Verification Error',
      color: 'bg-red-50 border-red-200',
      textColor: 'text-red-900',
      bgColor: 'bg-red-100',
    },
  };

  const config = statusConfig[status] || statusConfig.error;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-2">Document Verification</h1>
          <p className="text-gray-400">Verify the authenticity of official documents</p>
        </div>

        {/* Verification Card */}
        <div className={`rounded-lg border-2 p-8 mb-8 ${config.color}`}>
          <div className="text-center mb-6">
            <div className={`text-6xl mb-4 ${config.textColor}`}>{config.icon}</div>
            <h2 className={`text-2xl font-bold ${config.textColor}`}>{config.title}</h2>
          </div>

          {status === 'loading' && (
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-current"></div>
            </div>
          )}

          {status === 'verified' && data && (
            <div className="space-y-4">
              <div className="bg-white bg-opacity-50 rounded p-4">
                <p className="text-sm font-semibold text-gray-700">Document ID</p>
                <p className="text-lg font-mono text-gray-900">{documentId}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white bg-opacity-50 rounded p-4">
                  <p className="text-sm font-semibold text-gray-700">Recipient</p>
                  <p className="text-gray-900">{data.recipient_name}</p>
                </div>
                <div className="bg-white bg-opacity-50 rounded p-4">
                  <p className="text-sm font-semibold text-gray-700">Type</p>
                  <p className="text-gray-900 capitalize">{data.document_type.replace(/_/g, ' ')}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white bg-opacity-50 rounded p-4">
                  <p className="text-sm font-semibold text-gray-700">Issued</p>
                  <p className="text-gray-900">{new Date(data.generated_at).toLocaleDateString()}</p>
                </div>
                <div className="bg-white bg-opacity-50 rounded p-4">
                  <p className="text-sm font-semibold text-gray-700">Verification Views</p>
                  <p className="text-gray-900">{data.view_count}</p>
                </div>
              </div>
              {data.expires_at && (
                <div className="bg-white bg-opacity-50 rounded p-4">
                  <p className="text-sm font-semibold text-gray-700">Expires</p>
                  <p className="text-gray-900">{new Date(data.expires_at).toLocaleDateString()}</p>
                </div>
              )}
            </div>
          )}

          {(status === 'revoked' || status === 'expired') && (
            <div className="space-y-4">
              <div className="bg-white bg-opacity-50 rounded p-4">
                <p className={`font-semibold ${config.textColor}`}>{error}</p>
              </div>
              {data?.revoked_at && (
                <div className="bg-white bg-opacity-50 rounded p-4">
                  <p className="text-sm font-semibold text-gray-700">Revoked At</p>
                  <p className="text-gray-900">{new Date(data.revoked_at).toLocaleDateString()}</p>
                </div>
              )}
            </div>
          )}

          {status === 'not_found' && (
            <div className="bg-white bg-opacity-50 rounded p-4">
              <p className={`font-semibold ${config.textColor}`}>
                No document found with ID: <span className="font-mono">{documentId}</span>
              </p>
            </div>
          )}

          {status === 'error' && error && (
            <div className="bg-white bg-opacity-50 rounded p-4">
              <p className={`font-semibold ${config.textColor}`}>{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-gray-400 text-sm">
          <p className="mb-2">This verification is provided by JETON</p>
          <p>Last verified: {new Date().toLocaleString()}</p>
          <Link href="/" className="text-blue-400 hover:text-blue-300 mt-4 inline-block">
            Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
