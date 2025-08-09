'use client'

import { useState, useEffect } from 'react'
import { Search, Package, Clock, CheckCircle, AlertCircle, Rocket, Database, Zap } from 'lucide-react'
import DemoCard from '@/components/demos/DemoCard'
import DemoDrawer from '@/components/demos/DemoDrawer'
import InstalledList from '@/components/demos/InstalledList'
import { useDemos } from '@/hooks/useDemos'
import { Demo } from '@/types/demo'

export default function DemosPage() {
  const [activeTab, setActiveTab] = useState<'browse' | 'installed'>('browse')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [selectedDemo, setSelectedDemo] = useState<Demo | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  
  const { demos, loading, error, refreshDemos } = useDemos()
  
  // Filter demos based on search and tag
  const filteredDemos = demos.filter(demo => {
    const matchesSearch = !searchQuery || 
      demo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      demo.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      demo.summary.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesTag = !selectedTag || demo.tags.includes(selectedTag)
    
    return matchesSearch && matchesTag
  })
  
  // Get unique tags from all demos
  const allTags = Array.from(new Set(demos.flatMap(d => d.tags)))
  
  const handleDemoClick = (demo: Demo) => {
    setSelectedDemo(demo)
    setDrawerOpen(true)
  }
  
  const handleInstallSuccess = () => {
    // Refresh demos list after successful install
    refreshDemos()
    // Switch to installed tab
    setActiveTab('installed')
  }
  
  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Demo Showcase
        </h1>
        <p className="text-gray-600">
          Ready-made applications you can install and explore locally
        </p>
      </div>
      
      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('browse')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'browse'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Package className="inline w-4 h-4 mr-2" />
            Browse Demos
          </button>
          <button
            onClick={() => setActiveTab('installed')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'installed'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <CheckCircle className="inline w-4 h-4 mr-2" />
            Installed
          </button>
        </nav>
      </div>
      
      {activeTab === 'browse' ? (
        <>
          {/* Search and Filters */}
          <div className="mb-6 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search demos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            {/* Tag filters */}
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedTag(null)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    !selectedTag
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(tag)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      selectedTag === tag
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Demo Grid */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                <p className="text-red-700">Failed to load demos: {error}</p>
              </div>
            </div>
          ) : filteredDemos.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No demos found matching your criteria</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDemos.map(demo => (
                <DemoCard
                  key={demo.name}
                  demo={demo}
                  onClick={() => handleDemoClick(demo)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <InstalledList onDemoClick={handleDemoClick} />
      )}
      
      {/* Demo Drawer */}
      {selectedDemo && (
        <DemoDrawer
          demo={selectedDemo}
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onInstallSuccess={handleInstallSuccess}
        />
      )}
    </div>
  )
}