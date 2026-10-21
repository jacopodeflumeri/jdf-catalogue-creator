import type { Session } from "next-auth";

export interface AuditActor {
  mappUserId?: number;
  actorEmail?: string;
}

/**
 * Who to attribute an audit row to.
 *
 * `session.user.adminId` is a string, and is absent for SuperAdmins who have no
 * MappTeam row — hence optional rather than a throw. The email is recorded as
 * well so the row still names someone in that case, and after a team member is
 * deleted. A row with no actor at all is still worth writing; refusing to record
 * a change because we cannot name the person would be the wrong trade.
 */
export function sessionAuditActor(session: Session | null): AuditActor {
  const raw = session?.user?.adminId;
  const parsed = raw ? parseInt(String(raw), 10) : NaN;
  return {
    mappUserId: Number.isFinite(parsed) ? parsed : undefined,
    actorEmail: session?.user?.email || undefined,
  };
}
