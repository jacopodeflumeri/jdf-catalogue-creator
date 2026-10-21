/**
 * Internal Admin Authentication — shared hydration
 *
 * Maps an internal (Mapp-employee) identity onto the local MappTeam access model
 * and populates the NextAuth `user` object. Used by BOTH internal login paths so
 * they produce an identical session shape:
 *
 *   - the legacy direct Azure AD provider (authSource = "nextauth-azure")
 *   - the Keycloak broker (authSource = "keycloak"), which carries the company
 *     context enrichment (companyId / tenantId / workspaces / roles / ldapGroups)
 *
 * Authorization still keys off `role` / `isSuperAdmin` / `access` exactly as
 * before — the enrichment fields are identity/attribution data, not gates.
 *
 * New-member access (no pending/approval step):
 *   - the FIRST Mapp user ever (no team members yet) -> active / admin (bootstrap)
 *   - everyone after                                 -> active / viewer
 */

import logger from '@/lib/utils/logger';
import type { AdminData, AuthUserExtended, WorkspaceAccess } from '@/modules/auth/types';
import { prismaService } from '@/lib/prisma/services';
import { MappTeamMemberService } from './team-member-service';
import { getRawTeamMemberByEmailAction, updateTeamMemberForAuthAction } from './team-member-actions';
import { isSuperAdmin } from '../utils/auth-helpers';

type InternalIdentityProvider = 'entra' | 'internal' | 'mapp-cloud';
type InternalAuthSource = 'keycloak' | 'nextauth-azure';

interface InternalAdminIdentityInput {
  email: string;
  name: string;
  image?: string | null;
  authSource: InternalAuthSource;
  identityProvider: InternalIdentityProvider;
  graphAccessToken?: string;
  loginName?: string;
  userId?: string;
  companyId?: string;
  tenantId?: string;
  roles?: string[];
  workspaces?: WorkspaceAccess[];
  isMappEmployee?: boolean;
  mappLdapGroups?: string[];
  keycloakIdpHint?: string;
}

/**
 * Resolve the access for a brand-new internal team member.
 *
 * Bootstrap model (no pending/approval step):
 *   - the FIRST Mapp user ever to log in (no team members exist yet) becomes
 *     active/admin, so the app has an initial administrator;
 *   - everyone after is active/viewer — an existing admin promotes them to
 *     editor/admin as needed.
 *
 * `suspended`/`denied` remain available for moderation; SUPER_ADMINS is the
 * separate break-glass override. (Note: a true first-login race could create two
 * admins; acceptable for a one-time bootstrap.)
 */
async function resolveNewMemberAccessOverrides(
  identity: InternalAdminIdentityInput,
): Promise<{
  accessStatus: 'active' | 'suspended' | 'denied';
  accessLevel: 'viewer' | 'editor' | 'admin';
}> {
  const existingCount = await prismaService.mappTeam.countTeamMembers();
  if (existingCount === 0) {
    logger.log(
      'First Mapp team member — bootstrapping as active/admin:',
      identity.email,
    );
    return { accessStatus: 'active', accessLevel: 'admin' };
  }
  return { accessStatus: 'active', accessLevel: 'viewer' };
}

export async function hydrateInternalAdminUser(
  user: AuthUserExtended,
  identity: InternalAdminIdentityInput
): Promise<boolean> {
  try {
    const teamMemberResult = await getRawTeamMemberByEmailAction(identity.email);
    let teamMemberData = teamMemberResult.success ? teamMemberResult.data : null;

    if (teamMemberData) {
      const needsProfileUpdate =
        !teamMemberData.lastLoginAt ||
        !teamMemberData.firstname ||
        !teamMemberData.lastname;

      if (needsProfileUpdate) {
        try {
          const profileData = identity.graphAccessToken
            ? await MappTeamMemberService.getGraphProfileData(identity.graphAccessToken)
            : undefined;

          const teamMemberUpdateData = await MappTeamMemberService.createTeamMemberData(
            identity.email,
            identity.name,
            identity.image || undefined,
            profileData,
            'Admin'
          );

          await updateTeamMemberForAuthAction(teamMemberData.id.toString(), {
            ...teamMemberUpdateData,
            lastLoginAt: new Date()
          });

          teamMemberData.lastLoginAt = new Date();
          teamMemberData.firstname = teamMemberUpdateData.firstname;
          teamMemberData.lastname = teamMemberUpdateData.lastname;
          teamMemberData.title = teamMemberUpdateData.title;
          teamMemberData.role = teamMemberUpdateData.role;
          teamMemberData.location = teamMemberUpdateData.location || null;
          if (teamMemberUpdateData.image) {
            teamMemberData.image = teamMemberUpdateData.image as any;
          }

          logger.log('Successfully updated team member profile for internal auth user');
        } catch (error) {
          logger.error('Failed to update team member profile for internal auth user:', error);
        }
      } else {
        try {
          await updateTeamMemberForAuthAction(teamMemberData.id.toString(), {
            lastLoginAt: new Date()
          });
          teamMemberData.lastLoginAt = new Date();
        } catch (error) {
          logger.error('Failed to update lastLoginAt for internal auth user:', error);
        }
      }
    }

    if (!teamMemberData) {
      logger.log('Creating new internal Mapp team member for:', identity.email);

      const accessOverrides = await resolveNewMemberAccessOverrides(identity);

      const createdMember = await MappTeamMemberService.createTeamMemberFromAzureAD(
        {
          email: identity.email,
          name: identity.name,
          image: identity.image || undefined,
        },
        identity.graphAccessToken,
        'Admin',
        accessOverrides
      );

      if (!createdMember) {
        logger.error('Failed to create team member for:', identity.email);
        return false;
      }

      teamMemberData = {
        id: createdMember.id,
        createdAt: new Date(createdMember.created_at * 1000),
        updatedAt: new Date(),
        email: createdMember.email,
        firstname: createdMember.firstname,
        lastname: createdMember.lastname,
        title: createdMember.title,
        role: createdMember.role,
        location: createdMember.location || null,
        image: createdMember.image?.url || null,
        accessStatus: createdMember.accessStatus || 'active',
        accessLevel: createdMember.accessLevel || 'viewer',
        isSuperAdmin: createdMember.isSuperAdmin || false,
        lastLoginAt: createdMember.lastLoginAt || null,
        authorizedBy: createdMember.authorizedBy || null,
        authorizedAt: createdMember.authorizedAt || null,
        accessNotes: createdMember.accessNotes || null
      };
    }

    if (!teamMemberData) {
      logger.error('Team member data is unexpectedly null for internal auth user');
      return false;
    }

    user.adminId = String(teamMemberData.id);
    user.adminData = {
      id: teamMemberData.id,
      created_at: teamMemberData.createdAt instanceof Date
        ? teamMemberData.createdAt.toISOString()
        : teamMemberData.createdAt,
      email: teamMemberData.email || '',
      firstname: teamMemberData.firstname || '',
      lastname: teamMemberData.lastname || '',
      title: teamMemberData.title || '',
      role: teamMemberData.role || '',
      location: teamMemberData.location || undefined,
      accessStatus: teamMemberData.accessStatus,
      accessLevel: teamMemberData.accessLevel,
      isSuperAdmin: teamMemberData.isSuperAdmin,
      lastLoginAt: teamMemberData.lastLoginAt instanceof Date
        ? teamMemberData.lastLoginAt.toISOString()
        : teamMemberData.lastLoginAt,
      image: null
    } as unknown as AdminData;
    user.role = 'admin';
    user.authSource = identity.authSource;
    user.identityProvider = identity.identityProvider;
    user.loginName = identity.loginName;
    user.userId = identity.userId;
    user.companyId = identity.companyId;
    user.tenantId = identity.tenantId;
    user.roles = identity.roles;
    user.workspaces = identity.workspaces;
    user.isMappEmployee = identity.isMappEmployee;
    user.mappLdapGroups = identity.mappLdapGroups;
    user.keycloakIdpHint = identity.keycloakIdpHint;
    user.isSuperAdmin = isSuperAdmin(identity.email, teamMemberData.isSuperAdmin);

    return true;
  } catch (error) {
    logger.error('Internal admin authentication error:', error);
    return false;
  }
}
