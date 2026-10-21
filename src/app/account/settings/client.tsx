'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/providers/ToastProvider';
import { inviteTeamMember, updateUserNames } from '@/lib/actions/account/account-actions';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/modal/Modal';
import FormInput from '@/components/ui/form/FormInput';
import type { Session } from 'next-auth';
import type { AccountTeamMemberData } from '@/types';
import { sendCustomerMagicLinkAction } from '@/modules/auth/server/magic-link-client-actions';
import logger from '@/lib/utils/logger';

interface TeamMember {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'member' | 'viewer';
    status: 'active' | 'inactive' | 'pending' | 'expired';
    lastActive: string;
    joinedDate: string;
    permissions: string[];
}

interface TeamData {
    members: TeamMember[];
    permissions: {
        canInvite: boolean;
        canRemove: boolean;
        canChangeRoles: boolean;
    };
}

interface CustomerTeamClientProps {
    initialData: TeamData;
    session: Session;
    currentUserNames?: { firstName: string; lastName: string };
    accountDomains?: string[]; // Allowed domains for email validation
    teamEnabled?: boolean; // Whether team management is enabled
    hasMultipleAccounts?: boolean; // Whether the user has multiple accounts
}

const CustomerTeamClient: React.FC<CustomerTeamClientProps> = ({
    initialData,
    session,
    currentUserNames,
    accountDomains = [],
    teamEnabled = false,
    hasMultipleAccounts = false
}) => {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteFirstName, setInviteFirstName] = useState('');
    const [inviteLastName, setInviteLastName] = useState('');
    
    // Parse existing name or use empty strings
    const parseNameFromSession = (name?: string | null) => {
        if (!name || name.trim() === '') return { firstName: '', lastName: '' };
        const parts = name.trim().split(' ');
        return {
            firstName: parts[0] || '',
            lastName: parts.slice(1).join(' ') || ''
        };
    };
    
    const initialNames = currentUserNames && (currentUserNames.firstName || currentUserNames.lastName) 
        ? currentUserNames 
        : parseNameFromSession(session?.user?.name);
    
    const [firstName, setFirstName] = useState(initialNames.firstName);
    const [lastName, setLastName] = useState(initialNames.lastName);
    const [isUpdatingName, setIsUpdatingName] = useState(false);
    const { addToast } = useToast();

    const { members, permissions } = initialData;

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'inactive':
                return <Badge variant="secondary">Inactive</Badge>;
            case 'pending':
                return <Badge variant="warning">Pending Review</Badge>;
            case 'blocked':
                return <Badge variant="danger">Blocked</Badge>;
            case 'expired':
                return <Badge variant="danger">Expired</Badge>;
            default:
                return <Badge variant="primary">Active</Badge>;
        }
    };

    const sendMagicLink = async (member: AccountTeamMemberData) => {
        // Extract first and last name from the member's name
        const nameParts = (member.name || member.email.split('@')[0]).split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        logger.log(member)

        const result = await sendCustomerMagicLinkAction(
            member.email,
            firstName,
            lastName,
            undefined,
            undefined,
            '/account',
            false
        );

        if (result.success) {
            addToast({
                type: 'success',
                message: result.message
            });
        } else {
            addToast({
                type: 'error',
                message: result.message
            });
        }
    }

    const handleUpdateName = () => {
        if (!firstName.trim() && !lastName.trim()) {
            addToast({
                type: 'error',
                message: 'Please enter at least a first or last name'
            });
            return;
        }

        const currentFullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
        if (currentFullName === session?.user?.name) {
            addToast({
                type: 'info',
                message: 'No changes to save'
            });
            return;
        }

        setIsUpdatingName(true);
        startTransition(async () => {
            try {
                const result = await updateUserNames(firstName.trim(), lastName.trim());
                addToast({
                    type: 'success',
                    message: result.message
                });
                // Refresh to update the UI with new data
                router.refresh();
            } catch (error) {
                logger.error('Name update error:', error);
                addToast({
                    type: 'error',
                    message: error instanceof Error ? error.message : 'Failed to update names'
                });
            } finally {
                setIsUpdatingName(false);
            }
        });
    };

    const handleSignOut = () => {
        window.location.href = '/auth/signout?callbackUrl=%2Fauth%2Fsignin';
    };

    const handleSwitchAccount = () => {
        router.push('/auth/select-account');
    };

    const handleInviteMember = () => {
        if (!inviteFirstName.trim() && !inviteLastName.trim()) {
            addToast({
                type: 'error',
                message: 'Please enter at least a first or last name'
            });
            return;
        }

        if (!inviteEmail) {
            addToast({
                type: 'error',
                message: 'Please enter an email address'
            });
            return;
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(inviteEmail)) {
            addToast({
                type: 'error',
                message: 'Please enter a valid email address'
            });
            return;
        }

        // Domain validation if domains are configured
        if (accountDomains.length > 0) {
            const emailDomain = inviteEmail.split('@')[1]?.toLowerCase();
            if (!emailDomain || !accountDomains.includes(emailDomain)) {
                addToast({
                    type: 'error',
                    message: `Email domain must be one of: ${accountDomains.join(', ')}`
                });
                return;
            }
        }

        // Check for duplicate emails in existing team members
        const existingEmails = initialData.members.map(member => member.email.toLowerCase());
        if (existingEmails.includes(inviteEmail.toLowerCase())) {
            addToast({
                type: 'error',
                message: 'A team member with this email address already exists'
            });
            return;
        }

        startTransition(async () => {
            try {
                // Combine first and last names
                const finalName = [inviteFirstName.trim(), inviteLastName.trim()].filter(Boolean).join(' ');

                // Call the server action to add contact
                const result = await inviteTeamMember(inviteEmail, finalName);

                logger.log("IN", result)

                // Note: Magic link sending is now manual only - admin will review and send links
                addToast({
                    type: 'success',
                    message: `Team member invitation created! The invitation is pending admin review.`
                });

                // Close modal and reset form
                setIsInviteModalOpen(false);
                setInviteEmail('');
                setInviteFirstName('');
                setInviteLastName('');

                // Refresh the page to show updated team data
                router.refresh();
            } catch (error) {
                logger.error('Team invitation error:', error);
                addToast({
                    type: 'error',
                    message: error instanceof Error ? error.message : 'Failed to send invitation'
                });
            }
        });
    };

    const handleSendMagicLink = (member: AccountTeamMemberData) => {
        startTransition(async () => {
            try {
                await sendMagicLink(member);
            } catch (error) {
                logger.error('Magic link error:', error);
                addToast({
                    type: 'error',
                    message: error instanceof Error ? error.message : 'Failed to send magic link'
                });
            }
        });
    };

    return (
        <div >
            <div className="space-y-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
                        <p className="text-gray-500 text-lg">
                            Manage your profile{teamEnabled && ' and team member access'}
                        </p>
                    </div>
                    <div className="space-x-4">
                        {hasMultipleAccounts && (
                            <Button
                                variant="secondary"
                                onClick={handleSwitchAccount}
                            >
                                <Icon type="users" className="mr-2" size="sm" />
                                Switch Accounts
                            </Button>
                        )}
                        <Button
                            variant="secondary"
                            onClick={handleSignOut}
                        >
                            <Icon type="arrow-left" className="mr-2" size="sm" />
                            Sign Out
                        </Button>
                    </div>
                </div>
                {/* User Profile Form */}
                <Card
                    title="Profile Settings"
                    description={`Update details for: ${session?.user?.email || ''}`}
                >
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormInput
                                label="First Name"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                placeholder="Enter your first name"
                            />
                            <FormInput
                                label="Last Name"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                placeholder="Enter your last name"
                            />
                        </div>
                        <div className="flex justify-end">
                            <Button
                                variant="primary"
                                onClick={handleUpdateName}
                                disabled={
                                    isUpdatingName || 
                                    isPending || 
                                    (!firstName.trim() && !lastName.trim()) ||
                                    ([firstName.trim(), lastName.trim()].filter(Boolean).join(' ') === session?.user?.name)
                                }
                            >
                                {isUpdatingName ? 'Updating...' : 'Update Name'}
                            </Button>
                        </div>
                    </div>
                </Card>

                {teamEnabled && (
                    <>

                        <div className="gap-6">
                            {/* Team Members */}
                            <div>
                                <Card
                                    title="Team Members"
                                    description="Current access in your company"
                                    headerActions={
                                        permissions.canInvite && accountDomains.length > 0 ? (
                                            <Button
                                                variant="primary"
                                                size="sm"
                                                onClick={() => setIsInviteModalOpen(true)}
                                            >
                                                <Icon type="plus" className="mr-2" size="sm" />
                                                Invite
                                            </Button>
                                        ) : undefined
                                    }
                                >
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {members.filter((member: any) => member.email.toLowerCase() !== session?.user?.email?.toLowerCase()).length > 0
                                            ? members
                                                .filter((member: any) => member.email.toLowerCase() !== session?.user?.email?.toLowerCase())
                                                .map((member: any) => (
                                                    <div key={member.id} className="group relative flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                                                        <div className="flex items-center space-x-4">
                                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-medium">
                                                                {member.name.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <div className="font-medium text-gray-900">{member.name}</div>
                                                                <div className="text-sm text-gray-500">{member.email}</div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center space-x-2">
                                                            {/* Only show Send Access Link button for non-pending status members */}
                                                            {member.status !== 'pending' && (
                                                                <div className={`absolute right-0 p-2 ${isPending ? "opacity-100 bg-gray-50" : "opacity-0 group-hover:opacity-100 transition-opacity"}`}>
                                                                    <Button
                                                                        variant="primary"
                                                                        size="xs"
                                                                        disabled={isPending}
                                                                        onClick={() => handleSendMagicLink(member)}
                                                                        title="Send Magic Link to access dashboard"
                                                                    >
                                                                        <Icon type="mail" size="sm" className="mr-1" />
                                                                        Send Access Link
                                                                    </Button>
                                                                </div>
                                                            )}
                                                            <div className="flex items-center space-x-2">
                                                                {getStatusBadge(member.status)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            : (
                                                <div className="text-center py-8">
                                                    <Icon type="users" className="text-gray-400 mx-auto mb-4" size="2xl" />
                                                    <p className="text-gray-500">No team members yet</p>
                                                    <p className="text-xs text-gray-400 mt-1">Invite team members to get started</p>
                                                </div>
                                            )
                                        }
                                    </div>
                                </Card>
                            </div>
                        </div>

                        {/* Team Stats */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card className="relative overflow-hidden" hoverable>
                                <div className="flex items-center justify-between">
                                    <div className="space-y-2">
                                        <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Members</p>
                                        <p className="text-3xl font-bold text-gray-900">{members.length}</p>
                                    </div>
                                    <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                                        <Icon type="users" className="text-primary-600" size="lg" />
                                    </div>
                                </div>
                                <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-primary-500 to-primary-600"></div>
                            </Card>

                            <Card className="relative overflow-hidden" hoverable>
                                <div className="flex items-center justify-between">
                                    <div className="space-y-2">
                                        <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Active Members</p>
                                        <p className="text-3xl font-bold text-gray-900">{members.filter((m: any) => m.status === 'active').length}</p>
                                    </div>
                                    <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                                        <Icon type="check-circle" className="text-primary-600" size="lg" />
                                    </div>
                                </div>
                                <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-primary-500 to-primary-600"></div>
                            </Card>
                        </div>
                    </>
                )}

                {/* Invite Member Modal */}
                <Modal
                    isOpen={isInviteModalOpen}
                    onClose={() => setIsInviteModalOpen(false)}
                    title="Invite Team Member"
                    size='md'
                    footer={
                        accountDomains.length > 0 ? (
                            <div className="flex space-x-3 justify-end">
                                <Button
                                    variant="primary"
                                    onClick={handleInviteMember}
                                    disabled={isPending || !inviteEmail || (!inviteFirstName.trim() && !inviteLastName.trim())}
                                >
                                    {isPending ? 'Sending...' : 'Send For Review'}
                                </Button>
                            </div>
                        ) : (
                            <Button
                                variant="secondary"
                                onClick={() => setIsInviteModalOpen(false)}
                            >
                                Close
                            </Button>
                        )
                    }
                >
                    <div className="space-y-4">
                        {accountDomains.length > 0 ? (
                            <>

                                <div className="border-b border-gray-200 pb-4">
                                    <p className="mb-1 text-xs text-gray-500">
                                        Team members can only be invited from these domains:
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {accountDomains.join(', ')}
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormInput
                                        label="First Name"
                                        value={inviteFirstName}
                                        onChange={(e) => setInviteFirstName(e.target.value)}
                                        placeholder="Enter first name"
                                    />
                                    <FormInput
                                        label="Last Name"
                                        value={inviteLastName}
                                        onChange={(e) => setInviteLastName(e.target.value)}
                                        placeholder="Enter last name"
                                    />
                                </div>

                                <FormInput
                                    label="Email Address"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    placeholder={accountDomains.length === 1
                                        ? `name@${accountDomains[0]}`
                                        : `name@${accountDomains[0]} or name@${accountDomains.slice(1).join(' or name@')}`
                                    }
                                    required
                                />

                                <div className="border-t border-gray-200 pt-4">
                                    <p className="mt-1 text-xs text-gray-500">
                                        This contact will first need to be validated and released by the Mapp team.
                                    </p>
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Icon type="lock" className="text-gray-400" size="xl" />
                                </div>
                                <h3 className="text-lg font-medium text-gray-900 mb-2">Feature Not Currently Available</h3>
                                <p className="text-gray-500">
                                    Please contact your administrator to configure allowed email domains for your account.
                                </p>
                            </div>
                        )}
                    </div>
                </Modal>
            </div>
        </div>
    );
};

export default CustomerTeamClient;
