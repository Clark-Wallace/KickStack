'use client';

import { useState, useEffect } from 'react';
import { TemplateService, InstalledTemplate } from '@/lib/templates';

const templateService = new TemplateService();

export default function InstalledList() {
  const [installedTemplates, setInstalledTemplates] = useState<InstalledTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInstalledTemplates();
  }, []);

  const loadInstalledTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const templates = await templateService.getInstalledTemplates();
      setInstalledTemplates(templates);
    } catch (err) {
      setError('Failed to load installed templates');
      console.error('Error loading installed templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <p className="mt-2 text-gray-600">Loading installed templates...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (installedTemplates.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <div className="text-gray-400 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Templates Installed</h3>
        <p className="text-gray-500 mb-4">
          You haven't installed any templates yet. Browse the marketplace to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b">
          <h3 className="text-lg font-medium text-gray-900">
            Installed Templates ({installedTemplates.length})
          </h3>
        </div>
        
        <div className="divide-y divide-gray-200">
          {installedTemplates.map((template) => (
            <div key={template.name} className="px-6 py-4 hover:bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="text-base font-medium text-gray-900">
                    {template.name}
                  </h4>
                  <div className="mt-1 text-sm text-gray-500">
                    <span>Version: {template.version || '1.0.0'}</span>
                    <span className="mx-2">•</span>
                    <span>Installed: {formatDate(template.installed_at)}</span>
                  </div>
                  {template.path && (
                    <div className="mt-1 text-xs text-gray-400">
                      Path: {template.path}
                    </div>
                  )}
                </div>
                
                <div className="ml-4 flex items-center space-x-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Installed
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>💡 Tip:</strong> Installed templates have already applied their migrations 
          and functions. To reinstall or update a template, use the CLI with the --force flag.
        </p>
      </div>
    </div>
  );
}