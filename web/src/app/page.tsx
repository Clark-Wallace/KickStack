'use client';

import AuthPanel from '@/components/AuthPanel';
import TableExplorer from '@/components/TableExplorer';
import StatusPanel from '@/components/StatusPanel';
import FunctionsCard from '@/components/FunctionsCard';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">KickStack Dashboard</h1>
          <p className="text-lg text-gray-600 mt-2">Just Kick it - Local-first AI-powered backend</p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Auth Panel */}
          <div className="lg:col-span-1">
            <AuthPanel />
          </div>

          {/* Table Explorer - Takes up 2 columns */}
          <div className="lg:col-span-2">
            <TableExplorer />
          </div>

          {/* Status Panel */}
          <div className="lg:col-span-1">
            <StatusPanel />
          </div>

          {/* Functions Card */}
          <div className="lg:col-span-2">
            <FunctionsCard />
          </div>

          {/* Quick Links */}
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Template Marketplace */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">📦 Template Marketplace</h2>
              <p className="text-gray-600 mb-4">
                Browse and install prebuilt templates for common use cases.
              </p>
              <a
                href="/templates"
                className="inline-block px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Browse Templates →
              </a>
            </div>
            
            {/* Documentation */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">📚 Documentation</h2>
              <p className="text-gray-600 mb-4">
                Learn how to use KickStack and explore all features.
              </p>
              <div className="space-y-2">
                <a
                  href="https://github.com/yourusername/kickstack#readme"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-blue-500 hover:text-blue-600"
                >
                  View README
                </a>
                <a
                  href="https://github.com/yourusername/kickstack#templates--module-marketplace"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-blue-500 hover:text-blue-600"
                >
                  Template Documentation
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}