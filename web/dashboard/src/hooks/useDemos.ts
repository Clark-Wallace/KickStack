import { useState, useEffect, useCallback } from 'react'
import { Demo, DemoDetail, InstallResult, VerifyReport, InstallHistoryItem } from '@/types/demo'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787/api'

export function useDemos() {
  const [demos, setDemos] = useState<Demo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const fetchDemos = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`${API_BASE}/demos`)
      if (!response.ok) throw new Error('Failed to fetch demos')
      
      const data = await response.json()
      setDemos(data.demos || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load demos')
    } finally {
      setLoading(false)
    }
  }, [])
  
  useEffect(() => {
    fetchDemos()
  }, [fetchDemos])
  
  return {
    demos,
    loading,
    error,
    refreshDemos: fetchDemos
  }
}

export function useDemoDetail(name: string | null) {
  const [demo, setDemo] = useState<DemoDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    if (!name) {
      setDemo(null)
      return
    }
    
    const fetchDemo = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const response = await fetch(`${API_BASE}/demos/${name}`)
        if (!response.ok) throw new Error('Failed to fetch demo details')
        
        const data = await response.json()
        setDemo(data.demo)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load demo details')
      } finally {
        setLoading(false)
      }
    }
    
    fetchDemo()
  }, [name])
  
  return { demo, loading, error }
}

export function useDemoInstall() {
  const [installing, setInstalling] = useState(false)
  const [result, setResult] = useState<InstallResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const installDemo = async (name: string, options: { withSeed?: boolean; apply?: boolean } = {}) => {
    try {
      setInstalling(true)
      setError(null)
      setResult(null)
      
      // Get auth token from localStorage
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('Authentication required')
      }
      
      const response = await fetch(`${API_BASE}/demos/install`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          apply: options.apply !== false,
          withSeed: options.withSeed || false
        })
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to install demo')
      }
      
      const data = await response.json()
      setResult(data.result)
      return data.result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Installation failed'
      setError(message)
      throw new Error(message)
    } finally {
      setInstalling(false)
    }
  }
  
  return {
    installDemo,
    installing,
    result,
    error
  }
}

export function useDemoVerify() {
  const [verifying, setVerifying] = useState(false)
  const [report, setReport] = useState<VerifyReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const verifyDemo = async (name: string) => {
    try {
      setVerifying(true)
      setError(null)
      setReport(null)
      
      // Get auth token from localStorage
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('Authentication required')
      }
      
      const response = await fetch(`${API_BASE}/demos/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name })
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to verify demo')
      }
      
      const data = await response.json()
      setReport(data.report)
      return data.report
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verification failed'
      setError(message)
      throw new Error(message)
    } finally {
      setVerifying(false)
    }
  }
  
  return {
    verifyDemo,
    verifying,
    report,
    error
  }
}

export function useDemoHistory() {
  const [history, setHistory] = useState<InstallHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Get auth token from localStorage
      const token = localStorage.getItem('token')
      if (!token) {
        setHistory([])
        return
      }
      
      const response = await fetch(`${API_BASE}/demos/history`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!response.ok) throw new Error('Failed to fetch history')
      
      const data = await response.json()
      setHistory(data.history?.installs || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [])
  
  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])
  
  return {
    history,
    loading,
    error,
    refreshHistory: fetchHistory
  }
}