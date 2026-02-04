'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

interface Switch {
  id: number;
  name: string;
  ip_address: string;
  port: number;
  use_https?: boolean;
  username?: string;
}

interface EditSwitchModalProps {
  isOpen: boolean;
  switchData: Switch | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditSwitchModal({ isOpen, switchData, onClose, onSuccess }: EditSwitchModalProps) {
  const [ipAddress, setIpAddress] = useState('');
  const [port, setPort] = useState('9443');
  const [useHttps, setUseHttps] = useState(true);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (switchData) {
      setIpAddress(switchData.ip_address);
      setPort(switchData.port.toString());
      setUseHttps(switchData.use_https ?? true);
      setUsername(switchData.username || 'admin');
      setPassword('');
    }
  }, [switchData]);

  if (!isOpen || !switchData) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/v1/switches/${switchData.id}`, 
        { 
          ip_address: ipAddress, 
          port: parseInt(port),
          use_https: useHttps,
          username,
          password: password || undefined // Only send if changed
        },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update switch');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Edit Switch</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="col-span-2">
              <label className="block text-gray-300 text-sm font-medium mb-2">
                IP Address
              </label>
              <input
                type="text"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-extreme-blue focus:border-transparent transition"
                placeholder="192.168.1.1"
                required
              />
            </div>
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Port
              </label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-extreme-blue focus:border-transparent transition"
                placeholder="9443"
                required
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={useHttps}
                  onChange={(e) => setUseHttps(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:bg-extreme-blue transition-colors"></div>
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
              </div>
              <span className="text-gray-300 text-sm font-medium">Use HTTPS</span>
              <span className="text-xs text-gray-500">(recommended for production)</span>
            </label>
          </div>

          <div className="mb-4">
            <label className="block text-gray-300 text-sm font-medium mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-extreme-blue focus:border-transparent transition"
              placeholder="admin"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-300 text-sm font-medium mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-extreme-blue focus:border-transparent transition"
              placeholder="Leave empty to keep current"
            />
            <p className="mt-2 text-xs text-gray-500">
              Leave empty to keep the current password
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-extreme-purple to-extreme-blue text-white font-semibold rounded-lg hover:opacity-90 transition disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
