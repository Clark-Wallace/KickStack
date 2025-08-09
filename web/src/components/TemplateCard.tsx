'use client';

import { Template } from '@/lib/templates';

interface TemplateCardProps {
  template: Template;
  onClick: () => void;
}

export default function TemplateCard({ template, onClick }: TemplateCardProps) {
  const getCategoryIcon = (category: string): string => {
    const icons: Record<string, string> = {
      application: '🎯',
      utility: '🛠️',
      demo: '📚',
      component: '🧩'
    };
    return icons[category] || '📦';
  };

  const getTagColor = (tag: string): string => {
    const colors: Record<string, string> = {
      'public_read': 'bg-green-100 text-green-800',
      'owner': 'bg-blue-100 text-blue-800',
      'blog': 'bg-purple-100 text-purple-800',
      'ecommerce': 'bg-yellow-100 text-yellow-800',
      'demo': 'bg-gray-100 text-gray-800',
      'social': 'bg-pink-100 text-pink-800',
      'auth': 'bg-red-100 text-red-800',
      'payments': 'bg-indigo-100 text-indigo-800'
    };
    return colors[tag] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer p-6 border border-gray-200 hover:border-blue-300"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center">
          <span className="text-2xl mr-3">{getCategoryIcon(template.category)}</span>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {template.display_name}
            </h3>
            <p className="text-sm text-gray-500">{template.name}</p>
          </div>
        </div>
        {template.verified && (
          <div className="flex items-center">
            <span className="text-green-500" title="Verified by KickStack">✅</span>
          </div>
        )}
      </div>

      {/* Description */}
      <p className="text-gray-600 text-sm mb-4 line-clamp-2">
        {template.description}
      </p>

      {/* Tags */}
      {template.tags && template.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {template.tags.slice(0, 4).map(tag => (
            <span
              key={tag}
              className={`px-2 py-1 text-xs rounded-full ${getTagColor(tag)}`}
            >
              {tag}
            </span>
          ))}
          {template.tags.length > 4 && (
            <span className="px-2 py-1 text-xs text-gray-500">
              +{template.tags.length - 4} more
            </span>
          )}
        </div>
      )}

      {/* Contents Preview */}
      {template.contents && (
        <div className="border-t pt-3 mt-3">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex gap-3">
              {template.contents.tables && (
                <span>📊 {template.contents.tables.length} tables</span>
              )}
              {template.contents.policies && (
                <span>🔒 {template.contents.policies.length} policies</span>
              )}
              {template.contents.functions && (
                <span>⚡ {template.contents.functions.length} functions</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t text-xs text-gray-500">
        <div className="flex items-center gap-3">
          {template.author && <span>👤 {template.author}</span>}
          {template.license && <span>📄 {template.license}</span>}
        </div>
        {template.version && (
          <span className="text-gray-400">v{template.version}</span>
        )}
      </div>
    </div>
  );
}