import { Database, Zap, Users, ShoppingCart, Briefcase, BookOpen, CheckCircle } from 'lucide-react'
import { Demo } from '@/types/demo'

interface DemoCardProps {
  demo: Demo
  onClick: () => void
  installed?: boolean
}

// Icon mapping for demo types
const demoIcons: Record<string, any> = {
  blog: BookOpen,
  ecommerce: ShoppingCart,
  crm: Briefcase,
}

export default function DemoCard({ demo, onClick, installed = false }: DemoCardProps) {
  const Icon = demoIcons[demo.name] || Database
  
  return (
    <div
      onClick={onClick}
      className="relative bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-all cursor-pointer group"
    >
      {/* Installed badge */}
      {installed && (
        <div className="absolute top-4 right-4">
          <CheckCircle className="w-5 h-5 text-green-500" />
        </div>
      )}
      
      {/* Icon */}
      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
        <Icon className="w-6 h-6 text-blue-600" />
      </div>
      
      {/* Title */}
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {demo.title}
      </h3>
      
      {/* Summary */}
      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
        {demo.summary}
      </p>
      
      {/* Stats */}
      <div className="flex items-center space-x-4 text-sm text-gray-500">
        <div className="flex items-center">
          <Database className="w-4 h-4 mr-1" />
          <span>{demo.tables} tables</span>
        </div>
        <div className="flex items-center">
          <Zap className="w-4 h-4 mr-1" />
          <span>{demo.functions} functions</span>
        </div>
      </div>
      
      {/* Features badges */}
      <div className="mt-4 flex flex-wrap gap-1">
        {demo.hasRealtime && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
            Realtime
          </span>
        )}
        {demo.hasSeed && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
            Sample Data
          </span>
        )}
        {demo.tags.slice(0, 2).map(tag => (
          <span
            key={tag}
            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}