'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Sidebar from '@/components/Sidebar';
import AddSwitchModal from '@/components/AddSwitchModal';
import EditSwitchModal from '@/components/EditSwitchModal';

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
  use_https?: boolean;
  username?: string;
  status: string;
  last_sync: string | null;
  system_info: SystemInfo | null;
}

type SortField = 'name' | 'ip_address' | 'model' | 'version' | 'status';
type SortOrder = 'asc' | 'desc';

export default function SwitchesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [switches, setSwitches] = useState<Switch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editSwitch, setEditSwitch] = useState<Switch | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

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

  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    if (openMenuId !== null) {
      setTimeout(() => document.addEventListener('click', handleClickOutside), 0);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openMenuId]);

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

  const handleDelete = async (id: number) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/v1/switches/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDeleteConfirm(null);
      fetchSwitches();
    } catch (err) {
      console.error('Failed to delete switch:', err);
    }
  };

  const handleRefresh = async (id: number) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/v1/switches/${id}/sync`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchSwitches();
    } catch (err) {
      console.error('Failed to refresh switch:', err);
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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Filter, search and sort
  const filteredAndSortedSwitches = useMemo(() => {
    let result = [...switches];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(sw =>
        sw.name.toLowerCase().includes(query) ||
        sw.ip_address.toLowerCase().includes(query) ||
        sw.system_info?.modelName.toLowerCase().includes(query) ||
        sw.system_info?.firmwareVersion.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(sw => sw.status === statusFilter);
    }

    // Sort
    result.sort((a, b) => {
      let aVal: any, bVal: any;

      switch (sortField) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'ip_address':
          aVal = a.ip_address;
          bVal = b.ip_address;
          break;
        case 'model':
          aVal = a.system_info?.modelName || '';
          bVal = b.system_info?.modelName || '';
          break;
        case 'version':
          aVal = a.system_info?.firmwareVersion || '';
          bVal = b.system_info?.firmwareVersion || '';
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [switches, searchQuery, statusFilter, sortField, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedSwitches.length / itemsPerPage);
  const paginatedSwitches = filteredAndSortedSwitches.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    // Reset to page 1 when filters change
    setCurrentPage(1);
  }, [searchQuery, statusFilter, sortField, sortOrder]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-extreme-blue"></div>
      </div>
    );
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? (
      <svg className="w-4 h-4 inline ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 inline ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 flex">
      <Sidebar user={user} onLogout={handleLogout} />
      
      <main className="flex-1 p-8">
        <div className="flex justify-between items-center mb-6">
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

        {/* Search & Filters */}
        <div className="mb-6 flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name, IP, model, or version..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-extreme-blue"
              />
              <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-extreme-blue"
          >
            <option value="all">All Status</option>
            <option value="online">Online</option>
            <option value="connecting">Connecting</option>
            <option value="auth_failed">Auth Failed</option>
            <option value="error">Error</option>
          </select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-extreme-blue"></div>
          </div>
        ) : filteredAndSortedSwitches.length === 0 ? (
          <div className="bg-gray-800 rounded-xl p-12 text-center">
            <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
            </svg>
            <h3 className="text-xl font-semibold text-white mb-2">
              {switches.length === 0 ? 'No switches yet' : 'No switches match your filters'}
            </h3>
            <p className="text-gray-400 mb-4">
              {switches.length === 0
                ? 'Add your first Fabric Engine switch to get started'
                : 'Try adjusting your search or filters'
              }
            </p>
            {switches.length === 0 && (
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="px-4 py-2 bg-gradient-to-r from-extreme-purple to-extreme-blue text-white font-semibold rounded-lg hover:opacity-90 transition"
              >
                Add Switch
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="bg-gray-800 rounded-xl overflow-visible mb-4">
              <table className="w-full">
                <thead className="bg-gray-700/50">
                  <tr>
                    <th
                      onClick={() => handleSort('name')}
                      className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition"
                    >
                      Name <SortIcon field="name" />
                    </th>
                    <th
                      onClick={() => handleSort('ip_address')}
                      className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition"
                    >
                      Address <SortIcon field="ip_address" />
                    </th>
                    <th
                      onClick={() => handleSort('model')}
                      className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition"
                    >
                      Model <SortIcon field="model" />
                    </th>
                    <th
                      onClick={() => handleSort('version')}
                      className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition"
                    >
                      Version <SortIcon field="version" />
                    </th>
                    <th
                      onClick={() => handleSort('status')}
                      className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition"
                    >
                      Status <SortIcon field="status" />
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Last Sync
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {paginatedSwitches.map((sw) => (
                    <tr key={sw.id} className="hover:bg-gray-700/30 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-extreme-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                            </svg>
                          </div>
                          <p className="text-white font-medium">{sw.name}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-300">{sw.ip_address}:{sw.port}</td>
                      <td className="px-6 py-4 text-gray-300">{sw.system_info?.modelName || '-'}</td>
                      <td className="px-6 py-4 text-gray-300">{sw.system_info?.firmwareVersion || '-'}</td>
                      <td className="px-6 py-4">{getStatusBadge(sw.status)}</td>
                      <td className="px-6 py-4 text-gray-500 text-sm">
                        {sw.last_sync ? new Date(sw.last_sync).toLocaleTimeString() : '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="relative inline-block">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(openMenuId === sw.id ? null : sw.id);
                            }}
                            className="text-gray-400 hover:text-white transition p-1 rounded hover:bg-gray-700"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                            </svg>
                          </button>
                          
                          {openMenuId === sw.id && (
                            <div 
                              className="absolute right-0 top-full mt-1 w-48 bg-gray-700 rounded-lg shadow-xl border border-gray-600 z-50 py-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => {
                                  handleRefresh(sw.id);
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-4 py-2 text-left text-gray-300 hover:bg-gray-600 hover:text-white flex items-center gap-2"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Refresh
                              </button>
                              <button
                                onClick={() => {
                                  setEditSwitch(sw);
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-4 py-2 text-left text-gray-300 hover:bg-gray-600 hover:text-white flex items-center gap-2"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Edit
                              </button>
                              <hr className="my-1 border-gray-600" />
                              <button
                                onClick={() => {
                                  setDeleteConfirm(sw.id);
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-4 py-2 text-left text-red-400 hover:bg-gray-600 hover:text-red-300 flex items-center gap-2"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 bg-gray-800 rounded-xl">
                <div className="text-gray-400 text-sm">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredAndSortedSwitches.length)} of {filteredAndSortedSwitches.length} switches
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1 rounded transition ${
                        currentPage === page
                          ? 'bg-extreme-blue text-white'
                          : 'bg-gray-700 text-white hover:bg-gray-600'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <AddSwitchModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={handleSwitchAdded}
      />

      <EditSwitchModal
        isOpen={editSwitch !== null}
        switchData={editSwitch}
        onClose={() => setEditSwitch(null)}
        onSuccess={() => {
          setEditSwitch(null);
          fetchSwitches();
        }}
      />

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-2">Delete Switch?</h3>
            <p className="text-gray-400 mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
