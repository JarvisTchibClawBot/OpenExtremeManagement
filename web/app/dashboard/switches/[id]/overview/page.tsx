'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import axios from 'axios';
import SwitchSidebar from '@/components/SwitchSidebar';

interface User {
  id: number;
  username: string;
  role: string;
}

interface Port {
  id: number;
  name: string;
  status: 'up' | 'down' | 'disabled';
  speed: string;
}

interface Switch {
  id: number;
  name: string;
  ip_address: string;
  port: number;
  status: string;
  system_info: {
    modelName: string;
    firmwareVersion: string;
    numPorts: number;
  } | null;
}

export default function SwitchOverviewPage() {
  const router = useRouter();
  const params = useParams();
  const switchId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [switchData, setSwitchData] = useState<Switch | null>(null);
  const [ports, setPorts] = useState<Port[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

    fetchSwitch();
    fetchPorts();
  }, [switchId, router]);

  const fetchSwitch = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/v1/switches/${switchId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSwitchData(response.data.switch);
    } catch (err) {
      console.error('Failed to fetch switch:', err);
      router.push('/dashboard/switches');
    }
  };

  const fetchPorts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/v1/switches/${switchId}/ports`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPorts(response.data.ports || []);
    } catch (err) {
      console.error('Failed to fetch ports:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  const getPortColor = (status: string) => {
    switch (status) {
      case 'up':
        return 'bg-green-500';
      case 'disabled':
        return 'bg-red-500';
      case 'down':
      default:
        return 'bg-gray-500';
    }
  };

  const getPortStats = () => {
    const up = ports.filter(p => p.status === 'up').length;
    const down = ports.filter(p => p.status === 'down').length;
    const disabled = ports.filter(p => p.status === 'disabled').length;
    return { up, down, disabled };
  };

  if (!user || !switchData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-extreme-blue"></div>
      </div>
    );
  }

  const stats = getPortStats();

  return (
    <div className="min-h-screen bg-gray-900 flex">
      <SwitchSidebar user={user} switchData={switchData} onLogout={handleLogout} />
      
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Overview</h1>
          <p className="text-gray-400 mt-1">{switchData.system_info?.modelName || 'Switch'} - Port Status</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                <div className="w-6 h-6 bg-green-500 rounded-full"></div>
              </div>
              <div>
                <p className="text-gray-400 text-sm">UP</p>
                <p className="text-white text-2xl font-bold">{stats.up}</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-500/20 rounded-lg flex items-center justify-center">
                <div className="w-6 h-6 bg-gray-500 rounded-full"></div>
              </div>
              <div>
                <p className="text-gray-400 text-sm">DOWN</p>
                <p className="text-white text-2xl font-bold">{stats.down}</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center">
                <div className="w-6 h-6 bg-red-500 rounded-full"></div>
              </div>
              <div>
                <p className="text-gray-400 text-sm">DISABLED</p>
                <p className="text-white text-2xl font-bold">{stats.disabled}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Ports Grid */}
        <div className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-6">Ports</h2>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-extreme-blue"></div>
            </div>
          ) : (
            <div className="grid grid-cols-8 gap-4">
              {ports.map((port) => (
                <div
                  key={port.id}
                  className="relative group cursor-pointer"
                  title={`${port.name} - ${port.status.toUpperCase()} - ${port.speed}`}
                >
                  <div className={`aspect-square rounded-lg ${getPortColor(port.status)} transition hover:opacity-80 flex items-center justify-center`}>
                    <span className="text-white text-sm font-semibold">{port.id}</span>
                  </div>
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none">
                    {port.name}<br />
                    {port.status.toUpperCase()}<br />
                    {port.speed}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
