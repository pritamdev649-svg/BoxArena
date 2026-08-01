import type { Types } from 'mongoose';
import {
  MatchFormat,
  SportType,
  TeamInviteModel,
  TeamMemberRole,
  TeamModel,
  UserModel,
  type ITeam,
  type IUser,
} from '../../models/index.js';
import { withTransaction } from '../../shared/config/db.js';
import { env } from '../../shared/config/env.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../shared/errors/app-error.js';
import { inviteToken, publicId } from '../../shared/utils/ids.js';

/** Teams and invites (edge_cases.md §6). */

/** Max active members. Doubles is exactly 2; team sports have a ceiling. */
const MAX_SIZE: Record<MatchFormat, number> = {
  [MatchFormat.SINGLES]: 1,
  [MatchFormat.DOUBLES]: 2,
  [MatchFormat.TEAM]: 15,
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/(^-|-$)/gu, '');
}

export async function createTeam(input: {
  user: IUser;
  name: string;
  sport: SportType;
  format: MatchFormat;
  logoUrl?: string;
}): Promise<ITeam> {
  const slug = slugify(input.name);
  if (slug.length < 3) throw new BadRequestError('Team name is too short');

  /**
   * Names are unique per SPORT, not globally — the second person in Lucknow
   * who wants "Smashers" must not get a 500 (edge_cases.md §70).
   */
  const clash = await TeamModel.findOne({
    slug,
    sport: input.sport,
    isPseudoTeam: false,
    isActive: true,
  });

  if (clash) {
    throw new ConflictError('CONFLICT', `A ${input.sport} team called "${input.name}" already exists`, {
      suggestions: [`${input.name} FC`, `${input.name} Lucknow`, `Team ${input.name}`],
    });
  }

  const [team] = await TeamModel.create([
    {
      publicId: publicId('tm'),
      name: input.name.trim(),
      slug,
      captainId: input.user._id,
      sport: input.sport,
      format: input.format,
      members: [
        {
          userId: input.user._id,
          role: TeamMemberRole.CAPTAIN,
          joinedAt: new Date(),
          isActive: true,
        },
      ],
      eloRating: env.DEFAULT_ELO_RATING,
      ...(input.user.homeAreaName === undefined ? {} : { homeAreaName: input.user.homeAreaName }),
      ...(input.logoUrl === undefined ? {} : { logoUrl: input.logoUrl }),
    },
  ]);

  if (!team) throw new Error('Team creation returned nothing');
  return team;
}

export async function listMyTeams(user: IUser) {
  return TeamModel.find({ 'members.userId': user._id, isActive: true, isPseudoTeam: false })
    .populate('members.userId', 'publicId fullName avatarUrl')
    .lean();
}

export async function getTeam(teamPublicId: string) {
  const team = await TeamModel.findOne({ publicId: teamPublicId })
    .populate('members.userId', 'publicId fullName avatarUrl homeAreaName')
    .lean();
  if (!team) throw new NotFoundError('Team');
  return team;
}

function assertCaptain(team: ITeam, user: IUser): void {
  if (String(team.captainId) !== String(user._id)) {
    throw new ForbiddenError('Only the captain can do this');
  }
}


export async function createInvite(input: {
  user: IUser;
  teamPublicId: string;
  maxUses?: number;
  expiresInHours?: number;
}) {
  const team = await TeamModel.findOne({ publicId: input.teamPublicId });
  if (!team) throw new NotFoundError('Team');
  assertCaptain(team, input.user);

  const token = inviteToken();
  const expiresInHours = Math.min(input.expiresInHours ?? 48, 168);

  await TeamInviteModel.create({
    teamId: team._id,
    invitedByUserId: input.user._id,
    token,
    maxUses: Math.min(input.maxUses ?? 1, 20),
    expiresAt: new Date(Date.now() + expiresInHours * 3_600_000),
  });

  const joinUrl = `${env.API_BASE_URL.replace('/api/v1', '')}/join/${token}`;
  const message = `Join ${team.name} on BoxArena: ${joinUrl}`;

  return {
    token,
    joinUrl,
    whatsappUrl: `https://wa.me/?text=${encodeURIComponent(message)}`,
    expiresAt: new Date(Date.now() + expiresInHours * 3_600_000),
  };
}

export async function acceptInvite(input: { user: IUser; token: string }): Promise<ITeam> {
  return withTransaction(async (session) => {
    const invite = await TeamInviteModel.findOne({ token: input.token }).session(session);
    if (!invite) throw new NotFoundError('Invite');

    if (invite.revokedAt) throw new BadRequestError('This invite was cancelled');
    if (invite.expiresAt < new Date()) throw new BadRequestError('This invite has expired');
    if (invite.usedCount >= invite.maxUses) {
      throw new BadRequestError('This invite has already been used');
    }

    const team = await TeamModel.findById(invite.teamId).session(session);
    if (!team) throw new NotFoundError('Team');

    const alreadyIn = team.members.some(
      (member) => String(member.userId) === String(input.user._id) && member.isActive,
    );
    if (alreadyIn) return team;

    const activeCount = team.members.filter((member) => member.isActive).length;
    if (activeCount >= MAX_SIZE[team.format]) {
      throw new BadRequestError(`This team is full (${String(MAX_SIZE[team.format])} players)`);
    }

    team.members.push({
      userId: input.user._id as Types.ObjectId,
      role: TeamMemberRole.MEMBER,
      joinedAt: new Date(),
      isActive: true,
    });
    await team.save({ session });

    invite.usedCount += 1;
    invite.acceptedUserIds.push(input.user._id as Types.ObjectId);
    await invite.save({ session });

    return team;
  });
}

export async function removeMember(input: {
  user: IUser;
  teamPublicId: string;
  memberPublicId: string;
}): Promise<ITeam> {
  const team = await TeamModel.findOne({ publicId: input.teamPublicId });
  if (!team) throw new NotFoundError('Team');
  assertCaptain(team, input.user);

  const member = await UserModel.findOne({ publicId: input.memberPublicId });
  if (!member) throw new NotFoundError('Player');

  if (String(member._id) === String(team.captainId)) {
    throw new BadRequestError('The captain cannot be removed — transfer captaincy or leave');
  }

  await assertNoLiveChallenge(team._id as Types.ObjectId);

  const entry = team.members.find((m) => String(m.userId) === String(member._id));
  if (!entry) throw new NotFoundError('Team member');
  entry.isActive = false;

  await team.save();
  return team;
}

/**
 * Leaving with captain succession.
 *
 * A team must never be captain-less: promote the longest-tenured vice-captain,
 * else the oldest member, else soft-delete the team (edge_cases.md §73).
 */
export async function leaveTeam(input: { user: IUser; teamPublicId: string }): Promise<void> {
  const team = await TeamModel.findOne({ publicId: input.teamPublicId });
  if (!team) throw new NotFoundError('Team');

  await assertNoLiveChallenge(team._id as Types.ObjectId);

  const entry = team.members.find(
    (m) => String(m.userId) === String(input.user._id) && m.isActive,
  );
  if (!entry) throw new BadRequestError('You are not in this team');
  entry.isActive = false;

  if (String(team.captainId) === String(input.user._id)) {
    const successors = team.members
      .filter((m) => m.isActive)
      .sort((a, b) => {
        if (a.role === b.role) return a.joinedAt.getTime() - b.joinedAt.getTime();
        return a.role === TeamMemberRole.VICE_CAPTAIN ? -1 : 1;
      });

    const next = successors[0];
    if (next) {
      team.captainId = next.userId;
      next.role = TeamMemberRole.CAPTAIN;
    } else {
      team.isActive = false;
      team.deletedAt = new Date();
    }
  }

  await team.save();
}

/** Roster changes are blocked while a challenge involving the team is live. */
async function assertNoLiveChallenge(teamId: Types.ObjectId): Promise<void> {
  const { ChallengeModel, ChallengeStatus } = await import('../../models/index.js');

  const live = await ChallengeModel.findOne({
    $or: [{ creatorTeamId: teamId }, { opponentTeamId: teamId }],
    status: { $in: [ChallengeStatus.MATCHED, ChallengeStatus.LOCKED] },
  });

  if (live) {
    throw new BadRequestError(
      'This team has a match in progress. Roster changes are locked until it settles.',
    );
  }
}
