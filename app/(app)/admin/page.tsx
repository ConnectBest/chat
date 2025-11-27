"use client";
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';

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

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'channels'>('users');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [actionType, setActionType] = useState<'suspend' | 'activate' | 'delete' | null>(null);

  useEffect(() => {
    // Static code Backend team please change it to dynamic
    // Mock data
    setUsers([
      { id: '1', email: 'demo@test.com', name: 'Demo User', role: 'user', status: 'active', createdAt: new Date().toISOString() },
      { id: '2', email: 'admin@test.com', name: 'Admin User', role: 'admin', status: 'active', createdAt: new Date().toISOString() },
      { id: '3', email: 'suspended@test.com', name: 'Suspended User', role: 'user', status: 'suspended', createdAt: new Date().toISOString() },
    ]);

    setChannels([
      { id: 'general', name: 'general', memberCount: 5, createdAt: new Date().toISOString() },
      { id: 'random', name: 'random', memberCount: 3, createdAt: new Date().toISOString() },
    ]);
  }, []);

  function handleAction(user: User, action: 'suspend' | 'activate' | 'delete') {
    setSelectedUser(user);
    setActionType(action);
    setShowConfirmModal(true);
  }

  function confirmAction() {
    if (!selectedUser || !actionType) return;

    // Static code Backend team please change it to dynamic
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
        <h1 className="text-3xl font-bold text-white mb-8">Admin Dashboard</h1>

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-2 rounded-lg font-medium transition ${
              activeTab === 'users'
                ? 'bg-brand-600 text-white'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            Users ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('channels')}
            className={`px-6 py-2 rounded-lg font-medium transition ${
              activeTab === 'channels'
                ? 'bg-brand-600 text-white'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            Channels ({channels.length})
          </button>
        </div>

        {/* Users Tab */}
        {activeTab === 'users' && (
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
        {activeTab === 'channels' && (
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
                    <td className="px-6 py-4 text-white/70">{channel.memberCount}</td>
                    <td className="px-6 py-4 text-white/70 text-sm">
                      {new Date(channel.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" className="text-xs">
                          View
                        </Button>
                        <Button variant="danger" className="text-xs">
                          Archive
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-white/40 text-xs mt-6 text-center">
          Static code Backend team please change it to dynamic
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
