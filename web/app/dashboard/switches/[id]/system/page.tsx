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

interface SystemInfo {
  sysName: string;
  sysDescription: string;
  sysLocation: string;
  sysContact: string;
  modelName: string;
  firmwareVersion: string;
  nosType: string;
  chassisId: string;
  numPorts: number;
}

interface Switch {
  id: number;
  name: string;
  ip_address: string;
  port: number;
  status: string;
  system_info: SystemInfo | null;
}

export default function SwitchSystemPage() {
  const router = useRouter();
  const params = useParams();
  const switchId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [switchData, setSwitchData] = useState<Switch | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Editable fields
  const [sysName, setSysName] = useState('');
  const [sysLocation, setSysLocation] = useState('');
  const [sysContact, setSysContact] = useState('');

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
  }, [switchId, router]);

  const fetchSwitch = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/v1/switches/${switchId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const sw = response.data.switch;
      setSwitchData(sw);
      
      if (sw.system_info) {
        setSysName(sw.system_info.sysName || '');
        setSysLocation(sw.system_info.sysLocation || '');
        setSysContact(sw.system_info.sysContact || '');
      }
    } catch (err) {
      console.error('Failed to fetch switch:', err);
      router.push('/dashboard/switches');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `/api/v1/switches/${switchId}/system`,
        {
          sysName,
          sysLocation,
          sysContact,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setIsEditing(false);
      fetchSwitch();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update system info');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (switchData?.system_info) {
      setSysName(switchData.system_info.sysName || '');
      setSysLocation(switchData.system_info.sysLocation || '');
      setSysContact(switchData.system_info.sysContact || '');
    }
    setIsEditing(false);
    setError('');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  if (!user || !switchData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-extreme-blue"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex">
      <SwitchSidebar user={user} switchData={switchData} onLogout={handleLogout} />
      
      <main className="flex-1 p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">System Information</h1>
            <p className="text-gray-400 mt-1">View and edit system settings</p>
          </div>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-gradient-to-r from-extreme-purple to-extreme-blue text-white font-semibold rounded-lg hover:opacity-90 transition flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 bg-gradient-to-r from-extreme-purple to-extreme-blue text-white font-semibold rounded-lg hover:opacity-90 transition disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Editable Fields */}
          <div className="bg-gray-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Editable Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  System Name
                </label>
                <input
                  type="text"
                  value={sysName}
                  onChange={(e) => setSysName(e.target.value)}
                  disabled={!isEditing}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-extreme-blue disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  System Location
                </label>
                <input
                  type="text"
                  value={sysLocation}
                  onChange={(e) => setSysLocation(e.target.value)}
                  disabled={!isEditing}
                  placeholder="e.g. Datacenter A, Rack 12"
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-extreme-blue disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  System Contact
                </label>
                <input
                  type="text"
                  value={sysContact}
                  onChange={(e) => setSysContact(e.target.value)}
                  disabled={!isEditing}
                  placeholder="e.g. admin@example.com"
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-extreme-blue disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Read-only Info */}
          {switchData.system_info && (
            <>
              <div className="bg-gray-800 rounded-xl p-6">
                <h2 className="text-xl font-semibold text-white mb-4">Hardware Information</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Model</p>
                    <p className="text-white font-medium">{switchData.system_info.modelName}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Firmware Version</p>
                    <p className="text-white font-medium">{switchData.system_info.firmwareVersion}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">NOS Type</p>
                    <p className="text-white font-medium">{switchData.system_info.nosType}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Number of Ports</p>
                    <p className="text-white font-medium">{switchData.system_info.numPorts}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-400 text-sm mb-1">Chassis ID</p>
                    <p className="text-white font-medium font-mono text-sm">{switchData.system_info.chassisId}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-400 text-sm mb-1">System Description</p>
                    <p className="text-white font-medium">{switchData.system_info.sysDescription}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-xl p-6">
                <h2 className="text-xl font-semibold text-white mb-4">Connection</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">IP Address</p>
                    <p className="text-white font-medium">{switchData.ip_address}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Port</p>
                    <p className="text-white font-medium">{switchData.port}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Status</p>
                    <p className="text-white font-medium">{switchData.status}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
