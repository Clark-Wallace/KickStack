'use client';

import { useState, useEffect } from 'react';
import { ApiClient } from '@/lib/api';

interface ServiceStatus {
  api: boolean;
  auth: boolean;
}

export default function StatusPanel() {
  const [status, setStatus] = useState<ServiceStatus>({
    api: false,
    auth: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkServices();
    const interval = setInterval(checkServices, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const checkServices = async () => {
    setLoading(true);
    const newStatus: ServiceStatus = {
      api: await ApiClient.checkApiHealth(),
      auth: await ApiClient.checkAuthHealth(),
    };
    setStatus(newStatus);
    setLoading(false);
  };

  const StatusIndicator = ({ isOnline, label }: { isOnline: boolean; label: string }) => (
    <div className="flex items-center justify-between py-2">
      <span className="font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className={`text-sm ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">System Status</h2>
        <button
          onClick={checkServices}
          disabled={loading}
          className="text-sm text-blue-500 hover:text-blue-600 disabled:opacity-50"
        >
          {loading ? 'Checking...' : 'Refresh'}
        </button>
      </div>

      <div className="space-y-1 divide-y divide-gray-200">
        <StatusIndicator isOnline={status.api} label="PostgREST API" />
        <StatusIndicator isOnline={status.auth} label="GoTrue Auth" />
        
        <div className="flex items-center justify-between py-2">
          <span className="font-medium">MinIO Console</span>
          <a
            href={process.env.NEXT_PUBLIC_MINIO_CONSOLE}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
          >
            Open Console →
          </a>
        </div>
      </div>

      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
        <p className="text-sm text-yellow-800">
          <strong>Note:</strong> If a new table doesn't appear, restart the PostgREST container:
        </p>
        <code className="block mt-1 text-xs bg-yellow-100 p-2 rounded">
          docker-compose -f infra/docker-compose.yml restart postgrest
        </code>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <h3 className="font-medium mb-2">Quick Links</h3>
        <div className="space-y-1">
          <a
            href={process.env.NEXT_PUBLIC_API_BASE}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-sm text-blue-500 hover:text-blue-600"
          >
            API Base → {process.env.NEXT_PUBLIC_API_BASE}
          </a>
          <a
            href={process.env.NEXT_PUBLIC_AUTH_BASE}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-sm text-blue-500 hover:text-blue-600"
          >
            Auth Base → {process.env.NEXT_PUBLIC_AUTH_BASE}
          </a>
          {process.env.NODE_ENV === 'development' && (
            <a
              href="http://localhost:8025"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm text-blue-500 hover:text-blue-600"
            >
              MailHog → http://localhost:8025
            </a>
          )}
        </div>
      </div>
    </div>
  );
}