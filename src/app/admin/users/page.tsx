'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminTable from '@/components/admin/AdminTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { formatDate } from '@/lib/utils';
import type { Profile, VerificationStatus, AccountStatus } from '@/types';

interface UserWithDetails extends Profile {
  email?: string;
  total_orders?: number;
  total_listings?: number;
}

const VERIFICATION_COLORS: Record<VerificationStatus, string> = {
  UNVERIFIED: 'gray',
  PENDING: 'yellow',
  UNDER_REVIEW: 'blue',
  VERIFIED: 'green',
  REJECTED: 'red',
  EXPIRED: 'orange',
  SUSPENDED: 'red',
};

const ACCOUNT_COLORS: Record<AccountStatus, string> = {
  ACTIVE: 'green',
  SUSPENDED: 'red',
  BANNED: 'red',
  PENDING_VERIFICATION: 'yellow',
  DEACTIVATED: 'gray',
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterVerification, setFilterVerification] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedUser, setSelectedUser] = useState<UserWithDetails | null>(null);
  const [actionModal, setActionModal] = useState<{ type: string; user: UserWithDetails } | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const PAGE_SIZE = 20;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), search, status: filterStatus, verification: filterVerification });
      const res = await fetch(`/api/admin/users?${qs}`);
      if (!res.ok) throw new Error('Failed to load users');
      const json = await res.json();
      setUsers(json.users || []);
      setTotal(json.total || 0);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, filterStatus, filterVerification]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Moderation goes through the server: it checks the admin role, records who did it, and is rate limited
  const handleAction = async () => {
    if (!actionModal) return;
    setActionLoading(true);
    try {
      const { user, type } = actionModal;
      const res = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, action: type, note: actionNote || undefined }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Action failed');
      setActionModal(null);
      setActionNote('');
      fetchUsers();
    } catch (err) {
      console.error('Action failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const columns = [
    {
      key: 'full_name',
      label: 'Name',
      render: (user: UserWithDetails) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-sm font-medium text-green-700">
            {user.full_name?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <p className="font-medium text-gray-900 text-sm">{user.full_name || '—'}</p>
            <p className="text-xs text-gray-500">{user.phone || '—'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'verification_status',
      label: 'Verification',
      render: (user: UserWithDetails) => (
        <Badge variant={VERIFICATION_COLORS[user.verification_status] as never}>
          {user.verification_status}
        </Badge>
      ),
    },
    {
      key: 'account_status',
      label: 'Account',
      render: (user: UserWithDetails) => (
        <Badge variant={ACCOUNT_COLORS[user.account_status] as never}>
          {user.account_status}
        </Badge>
      ),
    },
    {
      key: 'location',
      label: 'Location',
      render: (user: UserWithDetails) => (
        <span className="text-sm text-gray-600">{user.location || '—'}</span>
      ),
    },
    {
      key: 'created_at',
      label: 'Joined',
      render: (user: UserWithDetails) => (
        <span className="text-sm text-gray-600">{formatDate(user.created_at)}</span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (user: UserWithDetails) => (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <button
            onClick={() => setSelectedUser(user)}
            className="py-1 text-sm font-semibold text-blue-600 hover:underline"
          >
            View
          </button>
          {user.account_status === 'ACTIVE' && (
            <>
              <button
                onClick={() => setActionModal({ type: 'suspend', user })}
                className="py-1 text-sm font-semibold text-yellow-600 hover:underline"
              >
                Suspend
              </button>
              <button
                onClick={() => setActionModal({ type: 'ban', user })}
                className="py-1 text-sm font-semibold text-red-600 hover:underline"
              >
                Ban
              </button>
            </>
          )}
          {(user.account_status === 'SUSPENDED' || user.account_status === 'BANNED') && (
            <button
              onClick={() => setActionModal({ type: 'activate', user })}
              className="py-1 text-sm font-semibold text-green-600 hover:underline"
            >
              Activate
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="text-gray-500 mt-1">Manage registered students</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {[
          { label: 'Total Users', value: total },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select
            value={filterVerification}
            onChange={(e) => { setFilterVerification(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">All Verification</option>
            <option value="UNVERIFIED">Unverified</option>
            <option value="PENDING">Pending</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="VERIFIED">Verified</option>
            <option value="REJECTED">Rejected</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="BANNED">Banned</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <AdminTable
        columns={columns}
        data={users}
        loading={loading}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPageChange={setPage}
      />

      {/* User Detail Modal */}
      <Modal
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title="User Details"
      >
        {selectedUser && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-2xl font-bold text-green-700">
                {selectedUser.full_name?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selectedUser.full_name}</h3>
                <p className="text-sm text-gray-500">{selectedUser.phone}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Verification</p>
                <Badge variant={VERIFICATION_COLORS[selectedUser.verification_status] as never}>
                  {selectedUser.verification_status}
                </Badge>
              </div>
              <div>
                <p className="text-gray-500">Account</p>
                <Badge variant={ACCOUNT_COLORS[selectedUser.account_status] as never}>
                  {selectedUser.account_status}
                </Badge>
              </div>
              <div>
                <p className="text-gray-500">Location</p>
                <p className="font-medium">{selectedUser.location || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500">Joined</p>
                <p className="font-medium">{formatDate(selectedUser.created_at)}</p>
              </div>
            </div>
            <div className="pt-4 border-t border-gray-100 flex justify-end">
              <Button variant="secondary" onClick={() => setSelectedUser(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Action Modal */}
      <Modal
        isOpen={!!actionModal}
        onClose={() => { setActionModal(null); setActionNote(''); }}
        title={actionModal ? `${actionModal.type.charAt(0).toUpperCase() + actionModal.type.slice(1)} User` : ''}
      >
        {actionModal && (
          <div className="space-y-4">
            <p className="text-gray-600">
              Are you sure you want to <strong>{actionModal.type}</strong>{' '}
              <strong>{actionModal.user.full_name}</strong>?
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Admin Note (optional)
              </label>
              <textarea
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                rows={3}
                placeholder="Reason for this action..."
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => { setActionModal(null); setActionNote(''); }}>
                Cancel
              </Button>
              <Button
                onClick={handleAction}
                loading={actionLoading}
                variant={actionModal.type === 'activate' ? 'primary' : 'danger'}
              >
                Confirm
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
