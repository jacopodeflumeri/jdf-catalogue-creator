'use client';

import { useState, useEffect, useTransition } from 'react';
import { useToast } from '@/components/providers/ToastProvider';
import Modal from '@/components/ui/modal/Modal';
import Button from '@/components/ui/Button';
import FormTextarea from '@/components/ui/form/FormTextarea';
import Icon from '@/components/ui/Icon';

import { updateEmployeeAccess } from '@/lib/actions/admin/access-management-actions';
import { getAccessStatusLabel, getAccessLevelLabel } from '@/modules/auth/utils/access-control';
import type { AccountTeamMemberData } from '@/types';
import S3ImageDisplay from '@/modules/s3_images/components/S3ImageDisplay';
import { getUserInitials } from '@/modules/navigation/utils/navigation-helpers';

interface EditAccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    employee: AccountTeamMemberData | null;
    currentUserId: string;
    onSuccess: () => void;
}

export default function EditAccessModal({
    isOpen,
    onClose,
    employee,
    currentUserId,
    onSuccess,
}: EditAccessModalProps) {
    const { addToast } = useToast();
    const [isPending, startTransition] = useTransition();

    const [formData, setFormData] = useState({
        accessStatus: 'active',
        accessLevel: 'viewer',
        accessNotes: '',
    });

    // Update form when employee changes or modal opens
    useEffect(() => {
        if (employee && isOpen) {
            setFormData({
                accessStatus: employee.status || 'active',
                accessLevel: employee.access || 'viewer',
                accessNotes: '',
            });
        }
    }, [employee, isOpen]);



    const handleSave = async () => {
        if (!employee) return;

        startTransition(async () => {
            try {
                // Update access settings
                const result = await updateEmployeeAccess({
                    employeeId: employee.id,
                    accessStatus: formData.accessStatus,
                    accessLevel: formData.accessLevel,
                    accessNotes: formData.accessNotes || undefined,
                });

                if (!result.success) {
                    throw new Error(result.error || 'Failed to update access');
                }



                addToast({
                    type: 'success',
                    message: 'Employee access updated successfully',
                });

                onSuccess();
                onClose();
            } catch (error) {
                addToast({
                    type: 'error',
                    message: error instanceof Error ? error.message : 'Failed to update access',
                });
            }
        });
    };

    if (!employee) return null;

    // Check if editing self
    const isEditingSelf = currentUserId === employee.id;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditingSelf ? "Edit Your Access Settings" : "Edit Employee Access"}
            size="lg"
            footer={
                <div className="flex justify-between gap-3">
                    {isEditingSelf && (
                        <div>
                            <p className="text-sm font-medium text-gray-900">
                                Editing Your Own Access
                            </p>
                            <p className="text-xs text-gray-700 mt-1">
                                You can modify your access level and other settings, but you cannot suspend or deny your own access.
                            </p>
                        </div>
                    )}
                    <Button
                        type="button"
                        variant="primary"
                        onClick={handleSave}
                        disabled={isPending}
                    >
                        {isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            }
        >
            <div className="space-y-6">

                {/* Employee Info */}
                <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center space-x-4">

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
                        <div>
                            <h3 className="font-semibold text-gray-900">{employee.name}</h3>
                            <p className="text-sm text-gray-600">{employee.email}</p>
                            {employee.title && (
                                <p className="text-xs text-gray-500">{employee.title}</p>
                            )}
                        </div>
                    </div>
                    <div>
                        {employee.lastLoginAt && (
                            <div className="ml-4">
                                <p className="text-xs text-gray-500">
                                    Last seen: {new Date(employee.lastLoginAt).toLocaleString()}
                                </p>
                            </div>
                        )}

                        {!employee.lastLoginAt && (
                            <div className="ml-4">
                                <p className="text-xs text-yellow-600 flex items-center">
                                    <Icon type="warning" className="mr-1" size="sm" />
                                    Never logged in
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Access Status */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Access Status
                        </label>
                        <select
                            value={formData.accessStatus}
                            onChange={(e) => setFormData({ ...formData, accessStatus: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            required
                        >
                            <option value="active">Active</option>
                            <option value="suspended" disabled={isEditingSelf}>
                                Suspended {isEditingSelf && '(Cannot suspend yourself)'}
                            </option>
                            <option value="denied" disabled={isEditingSelf}>
                                Denied {isEditingSelf && '(Cannot deny yourself)'}
                            </option>
                        </select>
                        <p className="mt-1 text-xs text-gray-500">
                            Current: <span className="font-medium">{getAccessStatusLabel(employee.status)}</span>
                        </p>
                    </div>

                    {/* Access Level */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Access Level
                        </label>
                        <select
                            value={formData.accessLevel}
                            onChange={(e) => setFormData({ ...formData, accessLevel: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            required
                        >
                            <option value="viewer">Viewer (Read Only)</option>
                            <option value="editor">Editor (Can Modify)</option>
                            <option value="admin">Admin (Full Access)</option>
                        </select>
                        <p className="mt-1 text-xs text-gray-500">
                            Current: <span className="font-medium">{getAccessLevelLabel(employee.access)}</span>
                        </p>
                    </div>
                </div>



                {/* Notes */}
                <FormTextarea
                    label="Notes (Optional)"
                    name="accessNotes"
                    value={formData.accessNotes}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, accessNotes: e.target.value })}
                    placeholder="Add any notes about this access change..."
                    rows={3}
                />
            </div>
        </Modal>
    );
}
