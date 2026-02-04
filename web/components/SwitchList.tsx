'use client';

import { useEffect, useState } from 'react';
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {switches.map((sw) => (
        <div
          key={sw.id}
          className="bg-gray-800 rounded-xl p-6 hover:bg-gray-750 transition cursor-pointer border border-gray-700 hover:border-extreme-blue/50"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center">
              <svg className="w-8 h-8 text-extreme-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
              </svg>
            </div>
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(sw.status)}`}>
              {getStatusLabel(sw.status)}
            </span>
          </div>

          <h3 className="text-lg font-semibold text-white mb-1">{sw.name}</h3>
          <p className="text-gray-400 text-sm mb-3">{sw.ip_address}:{sw.port}</p>

          {sw.system_info ? (
            <div className="space-y-2 pt-3 border-t border-gray-700">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Model</span>
                <span className="text-white font-medium">{sw.system_info.modelName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Version</span>
                <span className="text-white">{sw.system_info.firmwareVersion}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">System Name</span>
                <span className="text-white">{sw.system_info.sysName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Ports</span>
                <span className="text-white">{sw.system_info.numPorts}</span>
              </div>
              {sw.system_info.isDigitalTwin && (
                <div className="mt-2">
                  <span className="px-2 py-1 text-xs bg-purple-500/20 text-purple-400 rounded-full">
                    Digital Twin
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="pt-3 border-t border-gray-700">
              <p className="text-gray-500 text-sm">
                {sw.status === 'connecting' ? 'Fetching system info...' : 'System info unavailable'}
              </p>
            </div>
          )}

          {sw.last_sync && (
            <p className="text-xs text-gray-600 mt-3">
              Last sync: {new Date(sw.last_sync).toLocaleTimeString()}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
