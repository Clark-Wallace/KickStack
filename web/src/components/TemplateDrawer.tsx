'use client';

import { useState, useEffect } from 'react';
import { Template, TemplateService } from '@/lib/templates';
import ReactMarkdown from 'react-markdown';

interface TemplateDrawerProps {
  template: Template;
  isOpen: boolean;
  onClose: () => void;
  onInstallComplete?: () => void;
}

const templateService = new TemplateService();

export default function TemplateDrawer({ 
  template, 
  isOpen, 
  onClose, 
  onInstallComplete 
}: TemplateDrawerProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'readme' | 'contents'>('overview');
  const [templateDetails, setTemplateDetails] = useState<Template | null>(null);
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installMode, setInstallMode] = useState<'stage' | 'apply'>('stage');
  const [forceOverwrite, setForceOverwrite] = useState(false);
  const [installResult, setInstallResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    if (isOpen && template) {
      loadTemplateDetails();
      setInstallResult(null);
      setError(null);
    }
  }, [isOpen, template]);

  const loadTemplateDetails = async () => {
    try {
      setLoading(true);
      const details = await templateService.getTemplateDetails(template.name);
      setTemplateDetails(details);
    } catch (err) {
      console.error('Error loading template details:', err);
      setTemplateDetails(template); // Fallback to basic info
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async () => {
    // Show confirmation for apply mode or unverified templates
    if (installMode === 'apply' || !template.verified) {
      setShowConfirmModal(true);
      return;
    }
    
    performInstall();
  };

  const performInstall = async () => {
    setShowConfirmModal(false);
    
    try {
      setInstalling(true);
      setError(null);
      
      // Get auth token from localStorage
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Please login to install templates');
      }

      const result = await templateService.installTemplate(
        template.name,
        { mode: installMode, force: forceOverwrite },
        token
      );

      setInstallResult(result);
      
      if (onInstallComplete) {
        onInstallComplete();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to install template');
    } finally {
      setInstalling(false);
    }
  };

  if (!isOpen) return null;

  const details = templateDetails || template;

  return (
    <>
      {/* Drawer Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Drawer Content */}
      <div className="fixed right-0 top-0 h-full w-full md:w-2/3 lg:w-1/2 bg-white shadow-xl z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-6 z-10">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                {details.display_name}
                {details.verified && <span className="text-green-500" title="Verified">✅</span>}
              </h2>
              <p className="text-sm text-gray-500 mt-1">{details.name}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Security Warning for Unverified */}
        {!details.verified && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 m-6">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  <strong>⚠️ Unverified Template</strong><br />
                  This template has not been reviewed by KickStack maintainers. 
                  Please review the contents carefully before installation.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b px-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('readme')}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'readme'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              README
            </button>
            <button
              onClick={() => setActiveTab('contents')}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'contents'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Contents
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
                    <p className="text-gray-600">{details.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Details</h4>
                      <dl className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <dt className="text-gray-500">Category:</dt>
                          <dd className="text-gray-900">{details.category}</dd>
                        </div>
                        {details.author && (
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Author:</dt>
                            <dd className="text-gray-900">{details.author}</dd>
                          </div>
                        )}
                        {details.license && (
                          <div className="flex justify-between">
                            <dt className="text-gray-500">License:</dt>
                            <dd className="text-gray-900">{details.license}</dd>
                          </div>
                        )}
                        {details.version && (
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Version:</dt>
                            <dd className="text-gray-900">{details.version}</dd>
                          </div>
                        )}
                        {details.kickstack_min_version && (
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Min KickStack:</dt>
                            <dd className="text-gray-900">{details.kickstack_min_version}</dd>
                          </div>
                        )}
                      </dl>
                    </div>

                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Tags</h4>
                      <div className="flex flex-wrap gap-2">
                        {details.tags?.map(tag => (
                          <span
                            key={tag}
                            className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'readme' && (
                <div className="prose prose-sm max-w-none">
                  {details.readme ? (
                    <ReactMarkdown>{details.readme}</ReactMarkdown>
                  ) : (
                    <p className="text-gray-500 italic">No README available</p>
                  )}
                </div>
              )}

              {activeTab === 'contents' && (
                <div className="space-y-6">
                  {details.contents?.tables && details.contents.tables.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">📊 Tables</h4>
                      <ul className="space-y-1">
                        {details.contents.tables.map(table => (
                          <li key={table} className="flex items-center text-sm text-gray-600">
                            <span className="text-gray-400 mr-2">•</span>
                            {table}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {details.contents?.policies && details.contents.policies.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">🔒 RLS Policies</h4>
                      <ul className="space-y-1">
                        {details.contents.policies.map(policy => (
                          <li key={policy} className="flex items-center text-sm text-gray-600">
                            <span className="text-gray-400 mr-2">•</span>
                            {policy}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {details.contents?.functions && details.contents.functions.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">⚡ Edge Functions</h4>
                      <ul className="space-y-1">
                        {details.contents.functions.map(func => (
                          <li key={func} className="flex items-center text-sm text-gray-600">
                            <span className="text-gray-400 mr-2">•</span>
                            {func}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Installation Options */}
          <div className="mt-8 border-t pt-6">
            <h3 className="font-semibold text-gray-900 mb-4">Installation Options</h3>
            
            {/* Install Mode */}
            <div className="space-y-3 mb-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="stage"
                  checked={installMode === 'stage'}
                  onChange={(e) => setInstallMode('stage')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2">
                  <span className="font-medium">Stage Only</span>
                  <span className="text-sm text-gray-500 ml-2">
                    Download to _staged/ directories for review
                  </span>
                </span>
              </label>
              
              <label className="flex items-center">
                <input
                  type="radio"
                  value="apply"
                  checked={installMode === 'apply'}
                  onChange={(e) => setInstallMode('apply')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2">
                  <span className="font-medium">Apply Immediately</span>
                  <span className="text-sm text-gray-500 ml-2">
                    Apply migrations and deploy functions now
                  </span>
                </span>
              </label>
            </div>

            {/* Force Overwrite */}
            <label className="flex items-center mb-6">
              <input
                type="checkbox"
                checked={forceOverwrite}
                onChange={(e) => setForceOverwrite(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm">
                Force overwrite existing files
              </span>
            </label>

            {/* Error Message */}
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {installResult && (
              <div className="mb-4 bg-green-50 border border-green-200 rounded p-3">
                <p className="text-sm text-green-600 font-medium">{installResult.message}</p>
                {installResult.result && (
                  <div className="mt-2 text-xs text-green-600">
                    {installResult.result.migrations.length > 0 && (
                      <div>Migrations: {installResult.result.migrations.join(', ')}</div>
                    )}
                    {installResult.result.functions.length > 0 && (
                      <div>Functions: {installResult.result.functions.join(', ')}</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Install Button */}
            <button
              onClick={handleInstall}
              disabled={installing || !!installResult}
              className={`w-full py-2 px-4 rounded-md font-medium ${
                installing || installResult
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {installing ? 'Installing...' : installResult ? 'Installed' : 'Install Template'}
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md">
            <h3 className="text-lg font-semibold mb-4">Confirm Installation</h3>
            
            {!template.verified && (
              <div className="mb-4 p-3 bg-yellow-50 rounded">
                <p className="text-sm text-yellow-800">
                  ⚠️ This is an unverified template. Make sure you trust the source.
                </p>
              </div>
            )}
            
            {installMode === 'apply' && (
              <p className="text-gray-600 mb-4">
                This will immediately apply migrations to your database and deploy functions. 
                This action cannot be easily undone.
              </p>
            )}
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={performInstall}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Proceed with Installation
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}