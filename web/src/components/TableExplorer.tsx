'use client';

import { useState, useEffect, useRef } from 'react';
import { ApiClient } from '@/lib/api';
import { AuthService } from '@/lib/auth';
import { RealtimeClient, RealtimeChange } from '@/lib/realtime';

export default function TableExplorer() {
  const [tableName, setTableName] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [jsonInput, setJsonInput] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLive, setIsLive] = useState(false);
  const rowsPerPage = 25;
  
  const realtimeClient = useRef<RealtimeClient | null>(null);
  const isAuthenticated = AuthService.isAuthenticated();

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (realtimeClient.current) {
        realtimeClient.current.disconnect();
        realtimeClient.current = null;
      }
    };
  }, []);

  const loadTable = async (silent = false) => {
    if (!tableName) {
      setError('Please enter a table name');
      return;
    }

    if (!silent) {
      setError('');
      setLoading(true);
    }

    try {
      const data = await ApiClient.get(`/${tableName}`);
      setRows(Array.isArray(data) ? data : []);
      if (!silent) {
        setCurrentPage(1);
        setupRealtime();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load table');
      setRows([]);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const setupRealtime = () => {
    // Disconnect existing client
    if (realtimeClient.current) {
      realtimeClient.current.disconnect();
      realtimeClient.current = null;
    }

    // Create new realtime client
    realtimeClient.current = new RealtimeClient({
      tables: [tableName],
      onMessage: handleRealtimeChange,
      onConnect: () => setIsLive(true),
      onDisconnect: () => setIsLive(false),
      onError: (error) => {
        console.error('Realtime error:', error);
        setIsLive(false);
      }
    });

    realtimeClient.current.connect();
  };

  const handleRealtimeChange = (change: RealtimeChange) => {
    if (change.type === 'change' && change.table === tableName) {
      console.log('Realtime change:', change);
      
      if (change.op === 'insert' || change.op === 'update') {
        // Reload the current page to get the updated data
        loadTable(true);
      } else if (change.op === 'delete' && change.id) {
        // Remove the deleted row from local state
        setRows(prevRows => prevRows.filter(row => row.id !== change.id));
      }
    }
  };

  const addRow = async () => {
    if (!jsonInput) {
      setError('Please enter JSON data');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const data = JSON.parse(jsonInput);
      await ApiClient.post(`/${tableName}`, data);
      setJsonInput('');
      // Don't reload if realtime is connected - it will update automatically
      if (!isLive) {
        await loadTable(true);
      }
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON format');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to add row');
      }
    } finally {
      setLoading(false);
    }
  };

  const deleteRow = async (id: any) => {
    if (!confirm('Are you sure you want to delete this row?')) return;

    setError('');
    setLoading(true);

    try {
      await ApiClient.delete(`/${tableName}?id=eq.${id}`);
      // Don't reload if realtime is connected - it will update automatically
      if (!isLive) {
        await loadTable(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete row');
    } finally {
      setLoading(false);
    }
  };

  // Pagination
  const totalPages = Math.ceil(rows.length / rowsPerPage);
  const paginatedRows = rows.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  if (!isAuthenticated) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Table Explorer</h2>
        <p className="text-gray-600">Please login to use the Table Explorer</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Table Explorer</h2>
        {isLive && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-green-600">LIVE</span>
          </div>
        )}
      </div>
      
      {/* Table Input */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={tableName}
          onChange={(e) => setTableName(e.target.value)}
          placeholder="Enter table name (e.g., contacts)"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => loadTable()}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50"
        >
          Load Table
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded">
          {error}
        </div>
      )}

      {/* Add Row Form */}
      {tableName && rows !== null && (
        <div className="mb-6 p-4 bg-gray-50 rounded">
          <h3 className="font-medium mb-2">Add New Row</h3>
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder='{"name": "John Doe", "email": "john@example.com"}'
            className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          />
          <button
            onClick={addRow}
            disabled={loading}
            className="mt-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors disabled:opacity-50"
          >
            Add Row
          </button>
        </div>
      )}

      {/* Table Data */}
      {paginatedRows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {Object.keys(paginatedRows[0]).map((key) => (
                  <th
                    key={key}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {key}
                  </th>
                ))}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedRows.map((row, index) => (
                <tr key={index}>
                  {Object.entries(row).map(([key, value]) => (
                    <td key={key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </td>
                  ))}
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {row.id && (
                      <button
                        onClick={() => deleteRow(row.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex justify-between items-center">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {tableName && rows.length === 0 && !loading && !error && (
        <p className="text-gray-600">No data found in table "{tableName}"</p>
      )}
    </div>
  );
}