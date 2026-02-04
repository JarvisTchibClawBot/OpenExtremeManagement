'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';

interface Switch {
  id: number;
  name: string;
  ip_address: string;
  model: string;
  status: string;
  last_seen: string;
}

export default function SwitchList() {
  const [switches, setSwitches] = useState<Switch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSwitches();
  }, []);

  const fetchSwitches = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/v1/switches', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSwitches(response.data.switches || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch switches');
    } finally {
      setIsLoading(false);
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
        <p className="text-gray-400">Add your first Extreme Networks switch to get started</p>
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
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
              sw.status === 'online' 
                ? 'bg-green-500/20 text-green-400' 
                : 'bg-red-500/20 text-red-400'
            }`}>
              {sw.status}
            </span>
          </div>
          
          <h3 className="text-lg font-semibold text-white mb-1">{sw.name}</h3>
          <p className="text-gray-400 text-sm mb-3">{sw.ip_address}</p>
          
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{sw.model || 'Unknown model'}</span>
            <span>Last seen: {sw.last_seen ? new Date(sw.last_seen).toLocaleString() : 'Never'}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
