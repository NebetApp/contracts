import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { Input, Textarea } from '../ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table';
import {
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  ShieldCheckIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

// Mock verification data
const mockPendingRequests = [
  {
    id: '1',
    tokenId: '43',
    owner: '0x1234...5678',
    submittedAt: '2024-01-18T10:30:00Z',
    proofCount: 3,
    categories: ['Birth Year', 'Nationality', 'Vaccine Status'],
    requestMethod: 'Manual'
  },
  {
    id: '2', 
    tokenId: '45',
    owner: '0x9876...4321',
    submittedAt: '2024-01-19T15:45:00Z',
    proofCount: 5,
    categories: ['Birth Year', 'Vaccine Status', 'Medication Type', 'Allergy Type', 'Treatment Type'],
    requestMethod: 'ZKP'
  },
  {
    id: '3',
    tokenId: '47',
    owner: '0x5555...9999',
    submittedAt: '2024-01-20T08:15:00Z',
    proofCount: 2,
    categories: ['Nationality', 'Treatment Type'],
    requestMethod: 'Manual'
  }
];

const mockVerificationHistory = [
  {
    id: '1',
    tokenId: '42',
    owner: '0x1111...2222',
    status: 'approved',
    verifiedAt: '2024-01-20T14:20:00Z',
    verifier: '0x9876...4321',
    proofCount: 5,
    verificationUri: 'ipfs://QmX...'
  },
  {
    id: '2',
    tokenId: '44',
    owner: '0x3333...4444',
    status: 'rejected',
    verifiedAt: '2024-01-16T09:30:00Z',
    verifier: '0x9876...4321', 
    proofCount: 2,
    reason: 'Insufficient proof validation'
  }
];

const mockAnalytics = {
  totalRequests: 156,
  pendingRequests: 12,
  approvedRequests: 127,
  rejectedRequests: 17,
  averageReviewTime: '2.4 days',
  verificationRate: 88.2
};

export const Verification: React.FC = () => {
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [verificationForm, setVerificationForm] = useState({
    approved: true,
    verificationUri: '',
    reason: ''
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleVerify = () => {
    // Implementation would call verify() function on HealthPassport contract
    console.log('Verifying passport:', selectedRequest.tokenId, verificationForm);
    setShowVerifyModal(false);
    setVerificationForm({ approved: true, verificationUri: '', reason: '' });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="success">Approved</Badge>;
      case 'rejected':
        return <Badge variant="error">Rejected</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1E2E3F] font-heading">
          Verification Console MOCK DATA
        </h1>
        <p className="text-[#8F969C] mt-2 font-body">
          Review and verify health passport submissions
        </p>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card variant="elevated">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
            <ClockIcon className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#1E2E3F] font-heading">
              {mockAnalytics.pendingRequests}
            </div>
            <p className="text-xs text-[#8F969C] font-body">
              Awaiting verification
            </p>
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approval Rate</CardTitle>
            <CheckCircleIcon className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#1E2E3F] font-heading">
              {mockAnalytics.verificationRate}%
            </div>
            <p className="text-xs text-[#8F969C] font-body">
              {mockAnalytics.approvedRequests} approved
            </p>
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Review Time</CardTitle>
            <ClockIcon className="h-4 w-4 text-[#275365]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#1E2E3F] font-heading">
              {mockAnalytics.averageReviewTime}
            </div>
            <p className="text-xs text-[#8F969C] font-body">
              Time to verification
            </p>
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Processed</CardTitle>
            <ShieldCheckIcon className="h-4 w-4 text-[#275365]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#1E2E3F] font-heading">
              {mockAnalytics.totalRequests}
            </div>
            <p className="text-xs text-[#8F969C] font-body">
              All-time verifications
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Requests */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Pending Verification Requests</CardTitle>
          <CardDescription>
            Health passports awaiting verification review
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mockPendingRequests.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Passport ID</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Proofs</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockPendingRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-mono">#{request.tokenId}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {request.owner.slice(0, 6)}...{request.owner.slice(-4)}
                    </TableCell>
                    <TableCell>{formatDate(request.submittedAt)}</TableCell>
                    <TableCell>{request.proofCount} proofs</TableCell>
                    <TableCell>
                      <Badge variant={request.requestMethod === 'ZKP' ? 'info' : 'default'}>
                        {request.requestMethod}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedRequest(request);
                            setShowDetailsModal(true);
                          }}
                        >
                          <EyeIcon className="h-4 w-4 mr-1" />
                          Review
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            setSelectedRequest(request);
                            setShowVerifyModal(true);
                          }}
                        >
                          Verify
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <ClockIcon className="h-12 w-12 text-[#8F969C] mx-auto mb-4" />
              <h3 className="text-lg font-medium text-[#1E2E3F] font-heading mb-2">
                No Pending Requests
              </h3>
              <p className="text-[#8F969C] font-body">
                All verification requests have been processed.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Verification History */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Recent Verifications</CardTitle>
          <CardDescription>
            History of completed verification decisions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Passport ID</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Verified Date</TableHead>
                <TableHead>Verifier</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockVerificationHistory.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-mono">#{record.tokenId}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {record.owner.slice(0, 6)}...{record.owner.slice(-4)}
                  </TableCell>
                  <TableCell>{getStatusBadge(record.status)}</TableCell>
                  <TableCell>{formatDate(record.verifiedAt)}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {record.verifier.slice(0, 6)}...{record.verifier.slice(-4)}
                  </TableCell>
                  <TableCell>
                    {record.verificationUri && (
                      <a 
                        href={record.verificationUri} 
                        className="text-[#275365] hover:underline font-body"
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        View URI
                      </a>
                    )}
                    {record.reason && (
                      <span className="text-red-600 font-body">{record.reason}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Details Modal */}
      <Modal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        title={`Review Passport #${selectedRequest?.tokenId}`}
        size="lg"
      >
        {selectedRequest && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-[#1E2E3F] font-body">Owner</h4>
                <p className="text-[#8F969C] font-mono text-sm mt-1">
                  {selectedRequest.owner}
                </p>
              </div>
              <div>
                <h4 className="font-medium text-[#1E2E3F] font-body">Submitted</h4>
                <p className="text-[#8F969C] font-body mt-1">
                  {formatDate(selectedRequest.submittedAt)}
                </p>
              </div>
              <div>
                <h4 className="font-medium text-[#1E2E3F] font-body">Proof Count</h4>
                <p className="text-[#8F969C] font-body mt-1">
                  {selectedRequest.proofCount} proofs
                </p>
              </div>
              <div>
                <h4 className="font-medium text-[#1E2E3F] font-body">Method</h4>
                <p className="text-[#8F969C] font-body mt-1">
                  {selectedRequest.requestMethod}
                </p>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-[#1E2E3F] font-body mb-3">Proof Categories</h4>
              <div className="grid grid-cols-2 gap-2">
                {selectedRequest.categories.map((category: string, index: number) => (
                  <div key={index} className="flex items-center space-x-2 p-2 bg-[#F2F5F7] rounded-lg">
                    <DocumentTextIcon className="h-4 w-4 text-[#275365]" />
                    <span className="text-sm font-body text-[#1E2E3F]">{category}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex space-x-3">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setShowDetailsModal(false)}
              >
                Close
              </Button>
              <Button 
                variant="primary" 
                className="flex-1"
                onClick={() => {
                  setShowDetailsModal(false);
                  setShowVerifyModal(true);
                }}
              >
                Proceed to Verify
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Verify Modal */}
      <Modal
        isOpen={showVerifyModal}
        onClose={() => setShowVerifyModal(false)}
        title={`Verify Passport #${selectedRequest?.tokenId}`}
        size="lg"
      >
        {selectedRequest && (
          <div className="space-y-6">
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800 font-body">
                    Verification Decision
                  </p>
                  <p className="text-sm text-yellow-700 mt-1 font-body">
                    This action will permanently update the passport status on-chain.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-[#1E2E3F] font-body mb-3">Decision</h4>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="decision"
                      checked={verificationForm.approved}
                      onChange={() => setVerificationForm(prev => ({ ...prev, approved: true }))}
                      className="mr-2 text-green-600"
                    />
                    <span className="font-body">Approve</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="decision"
                      checked={!verificationForm.approved}
                      onChange={() => setVerificationForm(prev => ({ ...prev, approved: false }))}
                      className="mr-2 text-red-600"
                    />
                    <span className="font-body">Reject</span>
                  </label>
                </div>
              </div>

              {verificationForm.approved ? (
                <Input
                  label="Verification URI"
                  placeholder="IPFS hash or verification document URL"
                  value={verificationForm.verificationUri}
                  onChange={(e) => setVerificationForm(prev => ({ ...prev, verificationUri: e.target.value }))}
                  helper="Optional: Link to verification documentation"
                />
              ) : (
                <Textarea
                  label="Rejection Reason"
                  placeholder="Explain why this passport was rejected..."
                  value={verificationForm.reason}
                  onChange={(e) => setVerificationForm(prev => ({ ...prev, reason: e.target.value }))}
                  helper="This reason will be stored on-chain"
                />
              )}
            </div>

            <div className="flex space-x-3">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setShowVerifyModal(false)}
              >
                Cancel
              </Button>
              <Button 
                variant={verificationForm.approved ? 'success' : 'error'}
                className="flex-1"
                onClick={handleVerify}
              >
                {verificationForm.approved ? 'Approve Passport' : 'Reject Passport'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};