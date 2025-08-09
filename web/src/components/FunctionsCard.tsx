'use client';

import { useState } from 'react';

export default function FunctionsCard() {
  const [functionName, setFunctionName] = useState('hello');
  const [jsonBody, setJsonBody] = useState('{\n  "message": "Hello from dashboard!"\n}');
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const callFunction = async () => {
    setLoading(true);
    setError('');
    setResponse(null);

    try {
      // Parse JSON body
      let body;
      try {
        body = JSON.parse(jsonBody);
      } catch (e) {
        throw new Error('Invalid JSON in request body');
      }

      // Get auth token if available
      const token = localStorage.getItem('token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Call the function
      const functionsBase = process.env.NEXT_PUBLIC_FUNCTIONS_BASE || 'http://localhost:8787';
      const res = await fetch(`${functionsBase}/fn/${functionName}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setResponse(data);
    } catch (err: any) {
      setError(err.message || 'Failed to call function');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4">⚡ Edge Functions</h2>
      
      {/* Function Name Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Function Name
        </label>
        <input
          type="text"
          value={functionName}
          onChange={(e) => setFunctionName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="hello"
        />
        <p className="text-xs text-gray-500 mt-1">
          POST /fn/{functionName}
        </p>
      </div>

      {/* JSON Body Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Request Body (JSON)
        </label>
        <textarea
          value={jsonBody}
          onChange={(e) => setJsonBody(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          rows={6}
          placeholder='{"key": "value"}'
        />
      </div>

      {/* Call Button */}
      <button
        onClick={callFunction}
        disabled={loading || !functionName}
        className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Calling...' : 'Call Function'}
      </button>

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">Error: {error}</p>
        </div>
      )}

      {/* Response Display */}
      {response && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Response:</h3>
          <pre className="bg-gray-50 p-3 rounded-md overflow-x-auto text-xs">
            {JSON.stringify(response, null, 2)}
          </pre>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-md">
        <h3 className="text-sm font-medium text-blue-900 mb-1">Quick Start:</h3>
        <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
          <li>Start the gateway: <code className="bg-blue-100 px-1">npm run fngw:dev</code></li>
          <li>Create a function: <code className="bg-blue-100 px-1">npm run kickstack new-fn myfunction</code></li>
          <li>Call it from here with or without authentication</li>
        </ol>
      </div>
    </div>
  );
}