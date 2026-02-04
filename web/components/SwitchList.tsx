'use client';

import { useEffect, useState, useRef } from 'react';
import axios from 'axios';

interface SystemInfo {
  sysName: string;
  sysDescription: string;
  modelName: string;
  firmwareVersion: string;
  nosType: string;
  numPorts: number;
  isDigitalTwin: boolean;
}

interface Switch {
  id: number;
  name: string;
  ip_address: string;
  port: number;
  status: string;
  last_sync: string | null;
  system_info: SystemInfo | null;
}

export default function SwitchList() {
  const [switches, setSwitches] = useState<Switch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const fetchSwitches = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/v1/switches', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSwitches(response.data.switches || []);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch switches');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSwitches();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchSwitches, 10000);
    return () => clearInterval(interval);
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500/20 text-green-400';
      case 'connecting':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'auth_failed':
        return 'bg-red-500/20 text-red-400';
      case 'error':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'online':
        return 'Online';
      case 'connecting':
        return 'Connecting...';
      case 'auth_failed':
        return 'Auth Failed';
      case 'error':
        return 'Error';
      default:
        return status;
    }
  };

  const handleMenuToggle = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === id ? null : id);
  };

  const handleRefresh = async (sw: Switch) => {
    setOpenMenuId(null);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/v1/switches/${sw.id}/sync`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchSwitches();
    } catch (err) {
      console.error('Failed to refresh switch:', err);
    }
  };

  const handleDelete = async (sw: Switch) => {
    setOpenMenuId(null);
    if (!confirm(`Are you sure you want to delete "${sw.name}"?`)) {
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/v1/switches/${sw.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchSwitches();
    } catch (err) {
      console.error('Failed to delete switch:', err);
    }
  };

  const handleEdit = (sw: Switch) => {
    setOpenMenuId(null);
    // TODO: Implement edit modal
    alert(`Edit functionality coming soon for "${sw.name}"`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-extreme-blue"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (switches.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl p-12 text-center">
        <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
        </svg>
        <h3 className="text-xl font-semibold text-white mb-2">No switches yet</h3>
        <p className="text-gray-400">Add your first Extreme Networks Fabric Engine switch to get started</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl overflow-visible">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="text-left py-4 px-6 text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</th>
            <th className="text-left py-4 px-6 text-xs font-semibold text-gray-400 uppercase tracking-wider">Address</th>
            <th className="text-left py-4 px-6 text-xs font-semibold text-gray-400 uppercase tracking-wider">Model</th>
            <th className="text-left py-4 px-6 text-xs font-semibold text-gray-400 uppercase tracking-wider">Version</th>
            <th className="text-left py-4 px-6 text-xs font-semibold text-gray-400 uppercase tracking-wider">Ports</th>
            <th className="text-left py-4 px-6 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
            <th className="text-left py-4 px-6 text-xs font-semibold text-gray-400 uppercase tracking-wider">Last Sync</th>
            <th className="text-right py-4 px-6 text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody>
          {switches.map((sw) => (
            <tr key={sw.id} className="border-b border-gray-700/50 hover:bg-gray-750 transition">
              <td className="py-4 px-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-extreme-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-medium">{sw.name}</p>
                    {sw.system_info?.isDigitalTwin && (
                      <span className="text-xs text-purple-400">Digital Twin</span>
                    )}
                  </div>
                </div>
              </td>
              <td className="py-4 px-6 text-gray-300">{sw.ip_address}:{sw.port}</td>
              <td className="py-4 px-6 text-gray-300">{sw.system_info?.modelName || '-'}</td>
              <td className="py-4 px-6 text-gray-300">{sw.system_info?.firmwareVersion || '-'}</td>
              <td className="py-4 px-6 text-gray-300">{sw.system_info?.numPorts || '-'}</td>
              <td className="py-4 px-6">
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(sw.status)}`}>
                  {getStatusLabel(sw.status)}
                </span>
              </td>
              <td className="py-4 px-6 text-gray-400 text-sm">
                {sw.last_sync ? new Date(sw.last_sync).toLocaleTimeString() : '-'}
              </td>
              <td className="py-4 px-6 text-right relative">
                <button
                  onClick={(e) => handleMenuToggle(sw.id, e)}
                  className="p-2 hover:bg-gray-700 rounded-lg transition text-gray-400 hover:text-white"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                  </svg>
                </button>
                
                {openMenuId === sw.id && (
                  <div 
                    ref={menuRef}
                    className="absolute right-6 top-12 bg-gray-700 rounded-lg shadow-xl border border-gray-600 py-1 z-50 min-w-[140px]"
                  >
                    <button
                      onClick={() => handleRefresh(sw)}
                      className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-600 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh
                    </button>
                    <button
                      onClick={() => handleEdit(sw)}
                      className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-600 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
                    <hr className="my-1 border-gray-600" />
                    <button
                      onClick={() => handleDelete(sw)}
                      className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-600 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
