'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Sidebar from '@/components/Sidebar';
import AddSwitchModal from '@/components/AddSwitchModal';

interface User {
  id: number;
  username: string;
  role: string;
}

interface SystemInfo {
  sysName: string;
  modelName: string;
  firmwareVersion: string;
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

export default function SwitchesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [switches, setSwitches] = useState<Switch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (!token) {
      router.push('/');
      return;
    }

    if (userData) {
      setUser(JSON.parse(userData));
    }

    fetchSwitches();
    const interval = setInterval(fetchSwitches, 10000);
    return () => clearInterval(interval);
  }, [router]);

  const fetchSwitches = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/v1/switches', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSwitches(response.data.switches || []);
    } catch (err) {
      console.error('Failed to fetch switches:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  const handleSwitchAdded = () => {
    setIsAddModalOpen(false);
    fetchSwitches();
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      online: 'bg-green-500/20 text-green-400',
      connecting: 'bg-yellow-500/20 text-yellow-400',
      auth_failed: 'bg-red-500/20 text-red-400',
      error: 'bg-red-500/20 text-red-400',
    };
    const labels: Record<string, string> = {
      online: 'Online',
      connecting: 'Connecting',
      auth_failed: 'Auth Failed',
      error: 'Error',
    };
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${styles[status] || 'bg-gray-500/20 text-gray-400'}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-extreme-blue"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex">
      <Sidebar user={user} onLogout={handleLogout} />
      
      <main className="flex-1 p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Switches</h1>
            <p className="text-gray-400 mt-1">Manage your Fabric Engine switches</p>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-gradient-to-r from-extreme-purple to-extreme-blue text-white font-semibold rounded-lg hover:opacity-90 transition flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Switch
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-extreme-blue"></div>
          </div>
        ) : switches.length === 0 ? (
          <div className="bg-gray-800 rounded-xl p-12 text-center">
            <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
            </svg>
            <h3 className="text-xl font-semibold text-white mb-2">No switches yet</h3>
            <p className="text-gray-400 mb-4">Add your first Fabric Engine switch to get started</p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 bg-gradient-to-r from-extreme-purple to-extreme-blue text-white font-semibold rounded-lg hover:opacity-90 transition"
            >
              Add Switch
            </button>
          </div>
        ) : (
          <div className="bg-gray-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Address</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Model</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Version</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Ports</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Last Sync</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {switches.map((sw) => (
                  <tr key={sw.id} className="hover:bg-gray-700/30 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-extreme-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    <td className="px-6 py-4 text-gray-300">{sw.ip_address}:{sw.port}</td>
                    <td className="px-6 py-4 text-gray-300">{sw.system_info?.modelName || '-'}</td>
                    <td className="px-6 py-4 text-gray-300">{sw.system_info?.firmwareVersion || '-'}</td>
                    <td className="px-6 py-4 text-gray-300">{sw.system_info?.numPorts || '-'}</td>
                    <td className="px-6 py-4">{getStatusBadge(sw.status)}</td>
                    <td className="px-6 py-4 text-gray-500 text-sm">
                      {sw.last_sync ? new Date(sw.last_sync).toLocaleTimeString() : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-gray-400 hover:text-white transition">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <AddSwitchModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={handleSwitchAdded}
      />
    </div>
  );
}
