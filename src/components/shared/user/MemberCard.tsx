'use client';

import Card from '@/components/ui/Card';
import Icon from '@/components/ui/Icon';
import Badge from '@/components/ui/Badge';
import S3ImageDisplay from '@/modules/s3_images/components/S3ImageDisplay';
import type { AccountTeamMemberData } from '@/types';
import { ReactNode } from 'react';

interface MemberCardProps {
  member: AccountTeamMemberData;
  onClick?: (member: AccountTeamMemberData) => void;
  className?: string;
  actions?: ReactNode; // Custom action buttons/elements
  showActions?: boolean; // Whether to show the actions section
  type?: 'horizontal' | 'vertical'; // Layout type
  size?: 'sm' | 'md' | 'lg' | 'xl'; // Size for horizontal layout
  style?: "basic" | "import" | "primary";
}

export default function MemberCard({
  member,
  onClick,
  className = "",
  actions,
  showActions = false,
  type = 'horizontal',
  size = 'md',
  style = 'basic'
}: MemberCardProps) {

  const getStatusBadge = (status: string) => {
      switch (status?.toLowerCase()) {
          case 'inactive':
              return <Badge variant="secondary" size="xs" className="mt-2 truncate max-w-full">Inactive</Badge>;
          case 'pending':
              return <Badge variant="warning" size="xs" className="mt-2 truncate max-w-full">Pending Review</Badge>;
          case 'blocked':
              return <Badge variant="danger" size="xs" className="mt-2 truncate max-w-full">Blocked</Badge>;
          case 'expired':
              return <Badge variant="danger" size="xs" className="mt-2 truncate max-w-full">Expired</Badge>;
          default:
              return <Badge variant="primary" size="xs" className="mt-2 truncate max-w-full">Active</Badge>;
      }
  };

  const getClass = {
    imageBg: () => {
      switch (style) {
        case 'primary':
          return 'bg-primary-500';
        case 'basic':
        default:
          return 'bg-gray-200';
      }
    },
    imageSize: () => {
      switch (size) {
        case 'sm':
          return 'w-12 h-12';
        case 'md':
          return 'w-16 h-16';
        case 'lg':
          return 'w-24 h-24';
        case 'xl':
          return 'w-32 h-32';
        default:
          return 'w-16 h-16';
      }
    },
    actualImageSize: () => {
      switch (size) {
        case 'sm':
          return 100;
        case 'md':
          return 200;
        case 'lg':
          return 300;
        default:
          return 200;
      }
    },
    spacing: () => {
      switch (size) {
        case 'sm':
          return '2';
        case 'md':
          return '4';
        case 'lg':
          return '6';
        case 'xl':
          return '8';
        default:
          return '4';
      }
    },
  }

  const handleClick = () => {
    if (onClick) {
      onClick(member);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Only trigger onClick if actions are not being clicked
    if (!showActions || !(e.target as Element).closest('.member-actions')) {
      handleClick();
    }
  };

  return (
    <div
      className={`${onClick ? 'cursor-pointer' : ''}`}
      onClick={handleCardClick}
    >
      <Card
        className={`${onClick ? 'hover:shadow-md transition-shadow' : ''} ${className}`}
        noPaddingContent
      >
        {type === 'vertical' ? (
          // Vertical layout
          <div className="flex flex-col items-center text-center space-y-4">
            <div className={`w-full flex justify-center text-center relative mb-${getClass.spacing()} py-0 px-${getClass.spacing()} ${getClass.imageBg()}`}>
              {member.image ? (
                <S3ImageDisplay
                  s3Image={member.image}
                  alt={member.name || `${member.firstname} ${member.lastname}`}
                  width={getClass.actualImageSize()}
                  height={getClass.actualImageSize()}
                  className={`${getClass.imageSize()} rounded-full object-cover relative top-${getClass.spacing()}`}
                  fallback={
                    <div className={`${getClass.imageSize()} rounded-full bg-primary-700 flex items-center justify-center text-white font-bold text-lg relative top-4`}>
                      {member.firstname && member.lastname
                        ? `${member.firstname.charAt(0)}${member.lastname.charAt(0)}`
                        : member.name?.split(' ').map(n => n.charAt(0)).join('').slice(0, 2) || '?'
                      }
                    </div>
                  }
                />
              ) : (
                <div className={`${getClass.imageSize()} rounded-full bg-primary-700 flex items-center justify-center text-white font-bold text-lg relative top-4`}>
                  {member.firstname && member.lastname
                    ? `${member.firstname.charAt(0)}${member.lastname.charAt(0)}`
                    : member.name?.split(' ').map(n => n.charAt(0)).join('').slice(0, 2) || '?'
                  }
                </div>
              )}
            </div>
            <div className={`flex-1 min-w-0 w-full px-6 py-${getClass.spacing()}`}>
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {member.name || `${member.firstname} ${member.lastname}`}
              </h3>
              <p className="text-sm text-gray-600 truncate">{member.email}</p>
              {member.title ? (
                <Badge variant="primary" size="xs" className="mt-2 truncate max-w-full" title={member.title}>
                  {member.title}
                </Badge>
              ) : (
                getStatusBadge(member.status)
              )}
            </div>
            <div className="flex flex-col gap-2 items-center w-full">
              {showActions && actions && (
                <div className="member-actions flex flex-col gap-2 items-center w-full">
                  {actions}
                </div>
              )}
            </div>
          </div>
        ) : (
          // Horizontal layout (default)
          <div className={`flex items-center justify-between p-${getClass.spacing()}`}>
            <div className="flex items-center space-x-4 flex-1 min-w-0">
              <div className="flex-shrink-0">
                {member.image ? (
                  <S3ImageDisplay
                    s3Image={member.image}
                    alt={member.name || `${member.firstname} ${member.lastname}`}
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded-full object-cover"
                    fallback={
                      <div className="w-12 h-12 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold">
                        {member.firstname && member.lastname
                          ? `${member.firstname.charAt(0)}${member.lastname.charAt(0)}`
                          : member.name?.split(' ').map(n => n.charAt(0)).join('').slice(0, 2) || '?'
                        }
                      </div>
                    }
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold">
                    {member.firstname && member.lastname
                      ? `${member.firstname.charAt(0)}${member.lastname.charAt(0)}`
                      : member.name?.split(' ').map(n => n.charAt(0)).join('').slice(0, 2) || <Icon type="user" className="w-4 h-4 text-white" />
                    }
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 overflow-hidden">
                <h3 className="text-lg font-semibold text-gray-900 truncate">
                  {member.name || `${member.firstname} ${member.lastname}`}
                </h3>
                <p className="text-sm text-gray-600 truncate">{member.email}</p>
                {member.title ? (
                  <Badge variant="primary" size="xs" className="mt-2 truncate max-w-full">
                    {member.title}
                  </Badge>
                ) : (
                getStatusBadge(member.status)
              )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {showActions && actions && (
                <div className="member-actions flex flex-col gap-2 items-center">
                  {actions}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
