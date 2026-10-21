'use client';

import { useState, useEffect, useTransition, useMemo } from 'react';
import { useToast } from '@/components/providers/ToastProvider';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Icon from '@/components/ui/Icon';
import FilterDropdown from '@/components/ui/filter/FilterDropdown';
import FilterOption from '@/components/ui/filter/FilterOption';
import FilterSearch from '@/components/ui/filter/FilterSearch';
import FilterClearButton from '@/components/ui/filter/FilterClearButton';
import {
    getAccessStatusLabel,
    getAccessLevelLabel,
} from '@/modules/auth/utils/access-control';
import { getMappTeamAccessList, grantEmployeeAccess, revokeEmployeeAccess } from '@/lib/actions/admin/access-management-actions';
import type { AccountTeamMemberData, TableColumn } from '@/types';
import Card from '../ui/Card';
import S3ImageDisplay from '@/modules/s3_images/components/S3ImageDisplay';
import { getUserInitials } from '@/modules/navigation/utils/navigation-helpers';
import { isSuperAdmin } from '@/modules/auth';

interface AccessManagementTableProps {
    initialData: AccountTeamMemberData[];
    onEditEmployee: (employee: AccountTeamMemberData) => void;
}

export default function AccessManagementTable({
    initialData,
    onEditEmployee,
}: AccessManagementTableProps) {
    const { addToast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [data, setData] = useState(initialData);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [levelFilter, setLevelFilter] = useState<string>('all');
    const [loginFilter, setLoginFilter] = useState<string>('all');

    // Update table data when parent data changes
    useEffect(() => {
        setData(initialData);
    }, [initialData]);

    // Filtered data
    const filteredData = useMemo(() => {
        return data.filter((employee) => {
            // Search filter
            if (searchTerm) {
                const search = searchTerm.toLowerCase();
                const matchesSearch =
                    employee.name?.toLowerCase().includes(search) ||
                    employee.email?.toLowerCase().includes(search) ||
                    employee.title?.toLowerCase().includes(search);
                if (!matchesSearch) return false;
            }

            // Status filter
            if (statusFilter !== 'all' && employee.status !== statusFilter) {
                return false;
            }

            // Level filter
            if (levelFilter !== 'all' && employee.access !== levelFilter) {
                return false;
            }

            // Login filter
            if (loginFilter === 'logged-in' && !employee.lastLoginAt) {
                return false;
            }
            if (loginFilter === 'never-logged-in' && employee.lastLoginAt) {
                return false;
            }

            return true;
        });
    }, [data, searchTerm, statusFilter, levelFilter, loginFilter]);

    // Refresh data
    const refreshData = () => {
        startTransition(async () => {
            try {
                const result = await getMappTeamAccessList();
                if (result.success && result.data) {
                    // Transform to AccountTeamMemberData format
                    const transformed = result.data.map((member: any) => ({
                        id: member.id.toString(),
                        user_id: member.id.toString(),
                        name: `${member.firstname || ''} ${member.lastname || ''}`.trim(),
                        email: member.email || '',
                        role: member.role || 'Team Member',
                        title: member.title,
                        firstname: member.firstname,
                        lastname: member.lastname,
                        image: member.image,
                        isActive: member.accessStatus === 'active',
                        access: member.accessLevel || 'viewer',
                        status: member.accessStatus || 'active',

                        lastLoginAt: member.lastLoginAt?.toISOString(),
                    }));
                    setData(transformed);
                }
            } catch {
                addToast({
                    type: 'error',
                    message: 'Failed to refresh data',
                });
            }
        });
    };

    // Quick actions
    const handleQuickGrant = (employee: AccountTeamMemberData) => {
        startTransition(async () => {
            try {
                const result = await grantEmployeeAccess({
                    employeeId: employee.id,
                    accessLevel: 'viewer',
                    notes: 'Quick grant via access management',
                });

                if (!result.success) {
                    throw new Error(result.error);
                }

                addToast({
                    type: 'success',
                    message: `Granted access to ${employee.name}`,
                });

                refreshData();
            } catch (error) {
                addToast({
                    type: 'error',
                    message: error instanceof Error ? error.message : 'Failed to grant access',
                });
            }
        });
    };

    const handleQuickRevoke = (employee: AccountTeamMemberData, type: 'suspended' | 'denied') => {
        startTransition(async () => {
            try {
                const result = await revokeEmployeeAccess({
                    employeeId: employee.id,
                    revocationType: type,
                    reason: `Quick ${type} via access management`,
                });

                if (!result.success) {
                    throw new Error(result.error);
                }

                addToast({
                    type: 'success',
                    message: `Access ${type === 'suspended' ? 'suspended' : 'denied'} for ${employee.name}`,
                });

                refreshData();
            } catch (error) {
                addToast({
                    type: 'error',
                    message: error instanceof Error ? error.message : 'Failed to revoke access',
                });
            }
        });
    };

    // Count filters for display
    const statusCounts = useMemo(() => {
        return {
            all: data.length,
            active: data.filter(e => e.status === 'active').length,
            suspended: data.filter(e => e.status === 'suspended').length,
            denied: data.filter(e => e.status === 'denied').length,
        };
    }, [data]);

    const levelCounts = useMemo(() => {
        return {
            all: data.length,
            admin: data.filter(e => e.access === 'admin').length,
            editor: data.filter(e => e.access === 'editor').length,
            viewer: data.filter(e => e.access === 'viewer').length,
        };
    }, [data]);

    const loginCounts = useMemo(() => {
        return {
            all: data.length,
            'logged-in': data.filter(e => e.lastLoginAt).length,
            'never-logged-in': data.filter(e => !e.lastLoginAt).length,
        };
    }, [data]);

    // Define table columns
    const columns: TableColumn<AccountTeamMemberData>[] = [
        {
            key: 'name',
            title: 'Employee',
            sortable: true,
            render: (_value, employee) => (
                <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10">
                        {employee.image?.url ? (
                            <S3ImageDisplay
                                s3Image={employee.image}
                                alt={employee.name}
                                width={40}
                                height={40}
                                className="w-10 h-10 rounded-full object-cover"
                                fallback={
                                    <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-bold">
                                        {getUserInitials(null, employee.name)}
                                    </div>
                                }
                            />
                        ) : (
                            <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                                <Icon type="user" className="text-primary-600" size="md" />
                            </div>
                        )}
                    </div>
                    <div className="ml-4">
                        <div className="flex items-center">
                            <div className="text-sm font-medium text-gray-900">{employee.name}</div>

                        </div>
                        <div className="text-sm text-gray-500">{employee.email}</div>
                        {employee.title && (
                            <div className="text-xs text-gray-400">{employee.title}</div>
                        )}
                    </div>
                </div>
            ),
        },
        {
            key: 'status',
            title: 'Status',
            sortable: true,
            render: (_value, employee) => (
                <>
                    <Badge
                        variant={employee.status === 'active' ? 'success' : employee.status === 'pending' ? 'warning' : 'danger'}
                        size="sm"
                    >
                        {getAccessStatusLabel(employee.status)}
                    </Badge>
                </>
            ),
        },
        {
            key: 'access',
            title: 'Access Level',
            sortable: true,
            render: (_value, employee) => (
                <div className='flex flex-col gap-2'>
                    <Badge
                        variant={
                            employee.access === 'admin' ? 'primary' :
                                employee.access === 'editor' ? 'purple' :
                                    employee.access === 'viewer' ? 'blue' :
                                        'danger'
                        }
                        size="sm"
                        className='w-fit'
                    >
                        {getAccessLevelLabel(employee.access)}
                    </Badge>
                    {isSuperAdmin(employee.email) && (
                        <Badge
                            variant={'warning'}
                            size="sm"
                            className='w-fit'
                        >
                            Super Admin
                        </Badge>
                    )}
                </div>
            ),
        },
        {
            key: 'lastLoginAt',
            title: 'Last Seen',
            sortable: true,
            render: (_value, employee) => (
                <span className="text-sm text-gray-500">
                    {employee.lastLoginAt ? (
                        new Date(employee.lastLoginAt).toLocaleString()
                    ) : (
                        <span className="text-gray-400 italic">Never</span>
                    )}
                </span>
            ),
        },
        {
            key: 'id',
            title: 'Actions',
            align: 'right',
            render: (_value, employee) => (
                <div className="flex items-center justify-end space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEditEmployee(employee)}
                    >
                        <Icon type="edit" size="sm" className="mr-1" />
                        Edit
                    </Button>

                    {employee.status === 'pending' && (
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleQuickGrant(employee)}
                            disabled={isPending}
                        >
                            <Icon type="check-circle" size="sm" className="mr-1" />
                            Grant
                        </Button>
                    )}

                    {employee.status === 'active' && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuickRevoke(employee, 'suspended')}
                            disabled={isPending}
                        >
                            <Icon type="warning" size="sm" className="mr-1" />
                            Suspend
                        </Button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            {/* Filters */}
            <Card noPaddingContent canOverflow className="p-4">
                <div className="flex gap-4">
                    {/* Search */}
                    <div className="lg:col-span-1">
                        <FilterSearch
                            value={searchTerm}
                            onChange={setSearchTerm}
                            placeholder="Search employees..."
                        />
                    </div>

                    {/* Status Filter */}
                    <FilterDropdown
                        label="Status"
                        icon="check-circle"
                        activeFilters={statusFilter !== 'all' ? [getAccessStatusLabel(statusFilter)] : []}
                    >
                        <FilterOption
                            label="All Status"
                            count={statusCounts.all}
                            isActive={statusFilter === 'all'}
                            onClick={() => setStatusFilter('all')}
                        />
                        <FilterOption
                            label="Active"
                            count={statusCounts.active}
                            isActive={statusFilter === 'active'}
                            onClick={() => setStatusFilter('active')}
                        />
                        <FilterOption
                            label="Suspended"
                            count={statusCounts.suspended}
                            isActive={statusFilter === 'suspended'}
                            onClick={() => setStatusFilter('suspended')}
                        />
                        <FilterOption
                            label="Denied"
                            count={statusCounts.denied}
                            isActive={statusFilter === 'denied'}
                            onClick={() => setStatusFilter('denied')}
                        />
                    </FilterDropdown>

                    {/* Level Filter */}
                    <FilterDropdown
                        label="Access Level"
                        icon="shield"
                        activeFilters={levelFilter !== 'all' ? [getAccessLevelLabel(levelFilter)] : []}
                    >
                        <FilterOption
                            label="All Levels"
                            count={levelCounts.all}
                            isActive={levelFilter === 'all'}
                            onClick={() => setLevelFilter('all')}
                        />
                        <FilterOption
                            label="Admin"
                            count={levelCounts.admin}
                            isActive={levelFilter === 'admin'}
                            onClick={() => setLevelFilter('admin')}
                        />
                        <FilterOption
                            label="Editor"
                            count={levelCounts.editor}
                            isActive={levelFilter === 'editor'}
                            onClick={() => setLevelFilter('editor')}
                        />
                        <FilterOption
                            label="Viewer"
                            count={levelCounts.viewer}
                            isActive={levelFilter === 'viewer'}
                            onClick={() => setLevelFilter('viewer')}
                        />

                    </FilterDropdown>

                    {/* Login Filter */}
                    <FilterDropdown
                        label="Login Status"
                        icon="clock"
                        activeFilters={loginFilter !== 'all' ? [loginFilter === 'logged-in' ? 'Has Logged In' : 'Never Logged In'] : []}
                    >
                        <FilterOption
                            label="All Employees"
                            count={loginCounts.all}
                            isActive={loginFilter === 'all'}
                            onClick={() => setLoginFilter('all')}
                        />
                        <FilterOption
                            label="Has Logged In"
                            count={loginCounts['logged-in']}
                            isActive={loginFilter === 'logged-in'}
                            onClick={() => setLoginFilter('logged-in')}
                        />
                        <FilterOption
                            label="Never Logged In"
                            count={loginCounts['never-logged-in']}
                            isActive={loginFilter === 'never-logged-in'}
                            onClick={() => setLoginFilter('never-logged-in')}
                        />
                    </FilterDropdown>

                    <FilterClearButton
                        onClick={refreshData}
                        title="Refresh data"
                        size="md"
                    />
                </div>
            </Card>

            {/* Table */}
            <Table
                data={filteredData as unknown as Record<string, unknown>[]}
                columns={columns as unknown as TableColumn<Record<string, unknown>>[]}
                loading={isPending}
                sortable={true}
            />
        </div>
    );
}
