'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminTable from '@/components/admin/AdminTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatDate } from '@/lib/utils';

interface VerificationRequest {
  id: string;
  user_id: string;
  verification_method: string;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  reviewer_id: string | null;
  rejection_reason: string | null;
  profiles?: {
    full_name: string;
    phone: string;
    location: string;
  };
  student_profiles?: {
    college_name: string;
    student_id_number: string;
    date_of_birth: string;
  };
  verification_documents?: Array<{
    id: string;
    document_type: string;
    storage_path: string;
    signed_url?: string | null;
  }>;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'yellow',
  UNDER_REVIEW: 'blue',
  VERIFIED: 'green',
  REJECTED: 'red',
};

export default function AdminVerificationPage() {
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('PENDING');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<VerificationRequest | null>(null);
  const [reviewModal, setReviewModal] = useState<{ request: VerificationRequest; action: 'approve' | 'reject' } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);

  const PAGE_SIZE = 20;

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/verification?status=${filterStatus}&page=${page}`);
      if (!res.ok) throw new Error('Failed to load requests');
      const json = await res.json();
      setRequests(json.requests || []);
      setTotal(json.total || 0);
    } catch (err) {
      console.error('Failed to fetch verification requests:', err);
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Signed URLs (5 min) are issued by the server with each request
  const handleViewDocument = (url: string | null | undefined) => {
    if (url) window.open(url, '_blank');
  };

  const handleReview = async () => {
    if (!reviewModal) return;
    setReviewLoading(true);
    try {
      const { request, action } = reviewModal;
      const response = await fetch('/api/admin/verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: request.id,
          action,
          rejectionReason: action === 'reject' ? rejectionReason : undefined,
        }),
      });

      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'Review action failed');

      setReviewModal(null);
      setSelected(null);
      setRejectionReason('');
      fetchRequests();
    } catch (err) {
      console.error('Review failed:', err);
    } finally {
      setReviewLoading(false);
    }
  };

  const columns = [
    {
      key: 'id',
      label: 'Verification ID',
      render: (req: VerificationRequest) => (
        <span className="font-mono text-xs text-gray-600">
          {req.id.substring(0, 8).toUpperCase()}
        </span>
      ),
    },
    {
      key: 'student',
      label: 'Student',
      render: (req: VerificationRequest) => (
        <div>
          <p className="font-medium text-gray-900 text-sm">{req.profiles?.full_name || '—'}</p>
          <p className="text-xs text-gray-500">{req.student_profiles?.college_name || '—'}</p>
        </div>
      ),
    },
    {
      key: 'method',
      label: 'Method',
      render: (req: VerificationRequest) => (
        <span className="text-sm text-gray-600">{req.verification_method}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (req: VerificationRequest) => (
        <Badge variant={STATUS_COLORS[req.status] as never}>{req.status}</Badge>
      ),
    },
    {
      key: 'submitted_at',
      label: 'Submitted',
      render: (req: VerificationRequest) => (
        <span className="text-sm text-gray-600">{formatDate(req.submitted_at)}</span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (req: VerificationRequest) => (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <button onClick={() => setSelected(req)} className="py-1 text-sm font-semibold text-blue-600 hover:underline">
            Review
          </button>
          {(req.status === 'PENDING' || req.status === 'UNDER_REVIEW') && (
            <>
              <button
                onClick={() => setReviewModal({ request: req, action: 'approve' })}
                className="py-1 text-sm font-semibold text-green-600 hover:underline"
              >
                Approve
              </button>
              <button
                onClick={() => setReviewModal({ request: req, action: 'reject' })}
                className="py-1 text-sm font-semibold text-red-600 hover:underline"
              >
                Reject
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Verification Requests</h1>
        <p className="text-gray-500 mt-1">Review student identity verification submissions</p>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {['', 'PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED'].map((status) => (
          <button
            key={status}
            onClick={() => { setFilterStatus(status); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              filterStatus === status
                ? 'bg-green-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {status || 'All'}
          </button>
        ))}
      </div>

      <AdminTable
        columns={columns}
        data={requests}
        loading={loading}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPageChange={setPage}
      />

      {/* Detail Modal */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Verification Details" size="lg">
        {selected && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500 mb-1">Student Name</p>
                <p className="font-medium">{selected.profiles?.full_name || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Phone</p>
                <p className="font-medium">{selected.profiles?.phone || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">College</p>
                <p className="font-medium">{selected.student_profiles?.college_name || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Student ID</p>
                <p className="font-medium">{selected.student_profiles?.student_id_number || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Method</p>
                <p className="font-medium">{selected.verification_method}</p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Status</p>
                <Badge variant={STATUS_COLORS[selected.status] as never}>{selected.status}</Badge>
              </div>
            </div>

            {selected.verification_documents && selected.verification_documents.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">Documents</p>
                <div className="flex flex-wrap gap-2">
                  {selected.verification_documents.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => handleViewDocument(doc.signed_url)}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {doc.document_type.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(selected.status === 'PENDING' || selected.status === 'UNDER_REVIEW') && (
              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <Button
                  onClick={() => { setReviewModal({ request: selected, action: 'approve' }); setSelected(null); }}
                  className="flex-1"
                >
                  Approve
                </Button>
                <Button
                  variant="danger"
                  onClick={() => { setReviewModal({ request: selected, action: 'reject' }); setSelected(null); }}
                  className="flex-1"
                >
                  Reject
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Review Confirmation Modal */}
      <Modal
        isOpen={!!reviewModal}
        onClose={() => { setReviewModal(null); setRejectionReason(''); }}
        title={reviewModal?.action === 'approve' ? 'Approve Verification' : 'Reject Verification'}
      >
        {reviewModal && (
          <div className="space-y-4">
            <p className="text-gray-600">
              {reviewModal.action === 'approve'
                ? `Approve verification for ${reviewModal.request.profiles?.full_name}? This will grant them full marketplace access.`
                : `Reject verification for ${reviewModal.request.profiles?.full_name}?`}
            </p>
            {reviewModal.action === 'reject' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  rows={3}
                  placeholder="Provide a clear reason for rejection..."
                />
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => { setReviewModal(null); setRejectionReason(''); }}>
                Cancel
              </Button>
              <Button
                onClick={handleReview}
                loading={reviewLoading}
                variant={reviewModal.action === 'approve' ? 'primary' : 'danger'}
                disabled={reviewModal.action === 'reject' && !rejectionReason.trim()}
              >
                {reviewModal.action === 'approve' ? 'Approve' : 'Reject'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
