"use client";
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { useRouter } from 'next/navigation';
import { getApiUrl } from '@/lib/apiConfig';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  status: 'active' | 'suspended';
  createdAt: string;
}

interface Channel {
  id: string;
  name: string;
  memberCount: number;
  createdAt: string;
}

interface Statistics {
  totalUsers: number;
  activeUsers: number;
  totalChannels: number;
  totalMessages: number;
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [statistics, setStatistics] = useState<Statistics>({ totalUsers: 0, activeUsers: 0, totalChannels: 0, totalMessages: 0 });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'channels' | 'powerbi'>('dashboard');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [actionType, setActionType] = useState<'suspend' | 'activate' | 'delete' | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      // Fetch statistics from backend
      try {
        const statsRes = await fetch(getApiUrl('users/statistics'), {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStatistics(statsData.statistics);
        } else {
          console.error('Statistics fetch failed:', statsRes.status);
        }
      } catch (err) {
        console.error('Statistics fetch error:', err);
      }

      // Fetch users
      try {
        const usersRes = await fetch(getApiUrl('users'), {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setUsers(usersData.users || []);
        } else {
          console.error('Users fetch failed:', usersRes.status);
        }
      } catch (err) {
        console.error('Users fetch error:', err);
      }

      // Fetch channels
      try {
        const channelsRes = await fetch(getApiUrl('chat/channels/all'), {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (channelsRes.ok) {
          const channelsData = await channelsRes.json();
          setChannels(channelsData.channels || []);
        } else {
          console.error('Channels fetch failed:', channelsRes.status);
        }
      } catch (err) {
        console.error('Channels fetch error:', err);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching admin data:', error);
      setLoading(false);
    }
  }

  function handleAction(user: User, action: 'suspend' | 'activate' | 'delete') {
    setSelectedUser(user);
    setActionType(action);
    setShowConfirmModal(true);
  }

  function confirmAction() {
    if (!selectedUser || !actionType) return;

    if (actionType === 'suspend') {
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, status: 'suspended' } : u));
      alert(`User ${selectedUser.email} has been suspended`);
    } else if (actionType === 'activate') {
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, status: 'active' } : u));
      alert(`User ${selectedUser.email} has been activated`);
    } else if (actionType === 'delete') {
      setUsers(prev => prev.filter(u => u.id !== selectedUser.id));
      alert(`User ${selectedUser.email} has been deleted`);
    }

    setShowConfirmModal(false);
    setSelectedUser(null);
    setActionType(null);
  }

  return (
    <div className="h-screen overflow-y-auto scrollbar-thin bg-gradient-to-br from-brand-900 via-brand-800 to-brand-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
          <Button
            variant="secondary"
            onClick={() => router.push('/chat')}
            className="flex items-center gap-2"
          >
            <span>←</span>
            <span>Back to Chat</span>
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-6 py-2 rounded-lg font-medium transition whitespace-nowrap ${
              activeTab === 'dashboard'
                ? 'bg-brand-600 text-white'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            📊 Dashboard
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-2 rounded-lg font-medium transition whitespace-nowrap ${
              activeTab === 'users'
                ? 'bg-brand-600 text-white'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            👥 Users ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('channels')}
            className={`px-6 py-2 rounded-lg font-medium transition whitespace-nowrap ${
              activeTab === 'channels'
                ? 'bg-brand-600 text-white'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            📢 Channels ({statistics.totalChannels})
          </button>
          <button
            onClick={() => setActiveTab('powerbi')}
            className={`px-6 py-2 rounded-lg font-medium transition whitespace-nowrap ${
              activeTab === 'powerbi'
                ? 'bg-brand-600 text-white'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            📈 Power BI
          </button>
        </div>

        {loading && (
          <div className="text-white text-center py-12">Loading...</div>
        )}

        {/* Dashboard Tab */}
        {!loading && activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 backdrop-blur-lg rounded-xl border border-blue-500/30 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-300 text-sm font-medium">Total Users</p>
                    <p className="text-white text-3xl font-bold mt-2">{statistics.totalUsers}</p>
                  </div>
                  <div className="text-4xl">👥</div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 backdrop-blur-lg rounded-xl border border-green-500/30 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-300 text-sm font-medium">Active Users</p>
                    <p className="text-white text-3xl font-bold mt-2">{statistics.activeUsers}</p>
                  </div>
                  <div className="text-4xl">✅</div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 backdrop-blur-lg rounded-xl border border-purple-500/30 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-300 text-sm font-medium">Total Channels</p>
                    <p className="text-white text-3xl font-bold mt-2">{statistics.totalChannels}</p>
                  </div>
                  <div className="text-4xl">📢</div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/20 backdrop-blur-lg rounded-xl border border-orange-500/30 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-300 text-sm font-medium">Total Messages</p>
                    <p className="text-white text-3xl font-bold mt-2">{statistics.totalMessages}</p>
                  </div>
                  <div className="text-4xl">💬</div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-6">
              <h2 className="text-xl font-bold text-white mb-4">Recent Users</h2>
              <div className="space-y-3">
                {users.slice(0, 5).map(user => (
                  <div key={user.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Avatar name={user.name} size="sm" status="online" />
                      <div>
                        <p className="text-white font-medium">{user.name}</p>
                        <p className="text-white/50 text-sm">{user.email}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      user.role === 'admin' 
                        ? 'bg-purple-500/20 text-purple-300' 
                        : 'bg-blue-500/20 text-blue-300'
                    }`}>
                      {user.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {!loading && activeTab === 'users' && (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 overflow-hidden">
            <table className="w-full">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white">User</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white">Email</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white">Role</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white">Joined</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-white">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} className="border-b border-white/5 hover:bg-white/5 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={user.name} size="sm" status="online" />
                        <span className="text-white font-medium">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-white/70">{user.email}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        user.role === 'admin' 
                          ? 'bg-purple-500/20 text-purple-300' 
                          : 'bg-blue-500/20 text-blue-300'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        user.status === 'active'
                          ? 'bg-green-500/20 text-green-300'
                          : 'bg-red-500/20 text-red-300'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-white/70 text-sm">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        {user.status === 'active' ? (
                          <Button
                            variant="secondary"
                            onClick={() => handleAction(user, 'suspend')}
                            className="text-xs"
                          >
                            Suspend
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            onClick={() => handleAction(user, 'activate')}
                            className="text-xs"
                          >
                            Activate
                          </Button>
                        )}
                        <Button
                          variant="danger"
                          onClick={() => handleAction(user, 'delete')}
                          className="text-xs"
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Channels Tab */}
        {!loading && activeTab === 'channels' && (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 overflow-hidden">
            <table className="w-full">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white">Channel</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white">Members</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white">Created</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-white">Actions</th>
                </tr>
              </thead>
              <tbody>
                {channels.map(channel => (
                  <tr key={channel.id} className="border-b border-white/5 hover:bg-white/5 transition">
                    <td className="px-6 py-4">
                      <span className="text-white font-medium">#{channel.name}</span>
                    </td>
                    <td className="px-6 py-4 text-white/70">{channel.memberCount || 0}</td>
                    <td className="px-6 py-4 text-white/70 text-sm">
                      {new Date(channel.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" className="text-xs" onClick={() => router.push(`/chat/${channel.id}`)}>
                          View
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Power BI Dashboard Tab */}
        {!loading && activeTab === 'powerbi' && (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-6">
            <h2 className="text-2xl font-bold text-white mb-6">📈 Power BI Analytics Dashboard</h2>
            <p className="text-white/60 mb-6">
              Embed your Power BI dashboard below. Replace the placeholder with your Power BI embed URL.
            </p>
            
            {/* Power BI Embed Placeholder */}
            <div className="bg-white/5 rounded-lg border-2 border-dashed border-white/20 overflow-hidden" style={{ height: '600px' }}>
              <iframe
                title="Power BI Dashboard"
                width="100%"
                height="100%"
                src="about:blank"
                frameBorder="0"
                className="w-full h-full"
              />
              
              {/* Placeholder Content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-brand-900/90 to-brand-800/90 pointer-events-none">
                <div className="text-8xl mb-4">📊</div>
                <h3 className="text-2xl font-bold text-white mb-2">Power BI Dashboard</h3>
                <p className="text-white/60 text-center max-w-md mb-4">
                  To integrate Power BI, replace the iframe src with your Power BI report embed URL
                </p>
                <div className="bg-white/10 rounded-lg p-4 max-w-2xl">
                  <p className="text-white/80 text-sm font-mono">
                    Example: https://app.powerbi.com/reportEmbed?reportId=YOUR_REPORT_ID&amp;autoAuth=true&amp;ctid=YOUR_TENANT_ID
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <h4 className="text-blue-300 font-semibold mb-2">🔧 Integration Steps:</h4>
              <ol className="text-white/70 text-sm space-y-2 list-decimal list-inside">
                <li>Create your report in Power BI Desktop</li>
                <li>Publish to Power BI Service</li>
                <li>Get the embed URL from File → Embed Report → Website or Portal</li>
                <li>Replace the iframe src attribute with your embed URL</li>
                <li>Configure authentication and permissions as needed</li>
              </ol>
            </div>
          </div>
        )}

        <p className="text-white/40 text-xs mt-6 text-center">
        </p>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && selectedUser && (
        <Modal
          open={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          title="Confirm Action"
          actions={
            <>
              <Button variant="ghost" onClick={() => setShowConfirmModal(false)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={confirmAction}>
                Confirm
              </Button>
            </>
          }
        >
          <p className="text-white/70">
            Are you sure you want to {actionType} user <strong>{selectedUser.email}</strong>?
          </p>
        </Modal>
      )}
    </div>
  );
}
