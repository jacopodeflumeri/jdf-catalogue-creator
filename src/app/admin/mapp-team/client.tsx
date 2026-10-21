'use client';

import { useState, useTransition } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Loading from '@/components/ui/Loading';
import Icon from '@/components/ui/Icon';
import { getMappTeamData } from '@/lib/actions/admin/admin-actions';
import AccessManagementTable from '@/components/admin/AccessManagementTable';
import EditAccessModal from '@/components/admin/modals/EditAccessModal';
import type { AccountTeamMemberData } from '@/types';
import logger from '@/lib/utils/logger';

interface TeamData {
  members: AccountTeamMemberData[];
  stats: {
    activeMembers: number;
  };
}

interface AdminMappTeamClientProps {
  initialData: TeamData;
  currentUserId: string;
}

export default function AdminMappTeamClient({ initialData, currentUserId }: AdminMappTeamClientProps) {
  const [data, setData] = useState(initialData);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  
  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<AccountTeamMemberData | null>(null);

  const refreshTeamData = () => {
    startTransition(async () => {
      try {
        setError(null);
        const newData = await getMappTeamData();
        setData(newData);
      } catch (err) {
        setError('Failed to refresh team data');
        logger.error('Team data refresh error:', err);
      }
    });
  };

  const handleEditEmployee = (employee: AccountTeamMemberData) => {
    setSelectedEmployee(employee);
    setIsEditModalOpen(true);
  };

  const handleModalSuccess = () => {
    refreshTeamData();
  };

  // Error state
  if (error && !isPending) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="p-6">
          <div className="text-center">
            <Icon type="x" size="xl" className="text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Team Data</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={refreshTeamData} disabled={isPending}>
              {isPending ? 'Refreshing...' : 'Try Again'}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">Mapp Team Access Management</h1>
          <p className="text-gray-500 text-lg">
            Manage employee access to admin pages and features.
          </p>
        </div>
      </div>

      {/* Loading overlay */}
      {isPending && (
        <div className="fixed inset-0 bg-gray-50/75 flex items-center justify-center z-50">
          <Loading size="lg" text="Refreshing team data..." />
        </div>
      )}

      {/* Access Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Card className="relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Active Access</p>
              <p className="text-3xl font-bold text-gray-900">{data.stats.activeMembers}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <Icon type="check-circle" className="text-green-600" size="lg" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-green-600"></div>
        </Card>

      </div>

      {/* Access Management Table */}
      <AccessManagementTable 
        initialData={data.members}
        onEditEmployee={handleEditEmployee}
      />

      {/* Modals */}
      <EditAccessModal
        isOpen={isEditModalOpen}
        employee={selectedEmployee}
        currentUserId={currentUserId}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedEmployee(null);
        }}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}
