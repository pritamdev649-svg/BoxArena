import { Router } from 'express';
import { z } from 'zod';
import { ChallengeModel, ChallengeStatus, SportType, ArenaModel, TeamModel, BookingModel, CourtModel, MatchFormat, TeamMemberRole, BookingStatus, BookingSource, UserModel } from '../../models/index.js';
import { authenticate, currentUser } from '../../shared/middlewares/auth.js';
import { validate, validatedQuery } from '../../shared/middlewares/validate.js';
import { created, ok } from '../../shared/utils/response.js';
import { NotFoundError } from '../../shared/errors/app-error.js';
import { publicId } from '../../shared/utils/ids.js';
import { Types } from 'mongoose';
import * as service from './challenge.service.js';
import { calculateMatchMoney } from './money.service.js';

export const challengeRoutes = Router();
challengeRoutes.use(authenticate);

const createSchema = z
  .object({
    bookingId: z.string().optional(),
    teamId: z.string().optional(),
    entryFeePaise: z.number().int().min(0).default(0),
    notes: z.string().max(500).optional(),
    sport: z.string().optional(),
    arenaName: z.string().optional(),
    startAt: z.string().optional(),
    format: z.string().optional(),
  })
  .strict();

const acceptSchema = z.object({ teamId: z.string() }).strict();

const feedQuery = z
  .object({
    sport: z.nativeEnum(SportType).optional(),
    maxEntryFeePaise: z.coerce.number().int().min(0).optional(),
    arenaPublicId: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  })
  .strict();

challengeRoutes.post('/', validate({ body: createSchema }), async (req, res, next) => {
  try {
    const user = currentUser(req);
    let { bookingId, teamId, entryFeePaise, notes, sport, arenaName, startAt, format } = req.body;

    if (!bookingId || !teamId) {
      let sportType = SportType.BADMINTON;
      if (sport) {
        const lower = sport.toLowerCase();
        if (lower.includes('cricket')) {
          sportType = SportType.CRICKET;
        } else if (lower.includes('football')) {
          sportType = SportType.FOOTBALL;
        }
      }

      if (!teamId) {
        let team = await TeamModel.findOne({ captainId: user._id, sport: sportType });
        let backendFormat: MatchFormat = MatchFormat.DOUBLES;
        if (sportType === SportType.FOOTBALL || sportType === SportType.CRICKET) {
          backendFormat = MatchFormat.TEAM;
        } else if (format) {
          const fLower = format.toLowerCase();
          if (fLower.includes('singles') || fLower.includes('1v1')) {
            backendFormat = MatchFormat.SINGLES;
          } else if (fLower.includes('6v6') || fLower.includes('8v8') || fLower.includes('11v11')) {
            backendFormat = MatchFormat.TEAM;
          }
        }

        if (!team) {
          const teamName = `${user.fullName}'s Team`;
          const teamSlug = teamName.toLowerCase().trim().replace(/[^a-z0-9]+/gu, '-').replace(/(^-|-$)/gu, '');
          
          let membersList = [{ userId: user._id, role: TeamMemberRole.CAPTAIN, isActive: true, joinedAt: new Date() }];
          if (backendFormat === MatchFormat.DOUBLES) {
            const secondUser = await UserModel.findOne({ _id: { $ne: user._id } });
            if (secondUser) {
              membersList.push({ userId: secondUser._id as Types.ObjectId, role: TeamMemberRole.MEMBER, isActive: true, joinedAt: new Date() });
            }
          }

          team = await TeamModel.create({
            publicId: publicId('tem'),
            name: teamName,
            slug: teamSlug,
            sport: sportType,
            format: backendFormat,
            captainId: user._id,
            members: membersList,
            stats: { played: 0, won: 0, lost: 0, eloRating: 1200 },
          });
        } else if (backendFormat === MatchFormat.DOUBLES && team.members.filter(m => m.isActive).length < 2) {
          const secondUser = await UserModel.findOne({ _id: { $ne: user._id } });
          if (secondUser) {
            team.members.push({ userId: secondUser._id as Types.ObjectId, role: TeamMemberRole.MEMBER, isActive: true, joinedAt: new Date() });
            await team.save();
          }
        }
        teamId = String(team._id);
      }

      if (!bookingId) {
        let arena = await ArenaModel.findOne({ name: arenaName });
        if (!arena) {
          arena = await ArenaModel.findOne({ isActive: true });
        }
        if (!arena) {
          throw new NotFoundError('Arena');
        }

        let court = await CourtModel.findOne({ arenaId: arena._id });
        if (!court) {
          court = await CourtModel.create({
            arenaId: arena._id,
            name: 'Court A',
            sport: sportType,
            basePricePerHourPaise: 40000,
            isActive: true,
          });
        }

        let startAtDate = new Date();
        if (startAt) {
          try {
            // Parse e.g. "Today 07:00 PM"
            let timeStr = startAt;
            if (startAt.includes('Today')) {
              timeStr = startAt.replace('Today', '').trim(); // e.g. "07:00 PM"
            }
            // Parse time
            const matches = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
            if (matches) {
              let hours = parseInt(matches[1]);
              const minutes = parseInt(matches[2]);
              const ampm = matches[3].toUpperCase();
              if (ampm === 'PM' && hours < 12) hours += 12;
              if (ampm === 'AM' && hours === 12) hours = 0;
              startAtDate.setHours(hours, minutes, 0, 0);
            } else {
              startAtDate = new Date(startAt);
            }
            if (isNaN(startAtDate.getTime())) {
              startAtDate = new Date(Date.now() + 2 * 3600_000);
            }
          } catch {
            startAtDate = new Date(Date.now() + 2 * 3600_000);
          }
        } else {
          startAtDate = new Date(Date.now() + 2 * 3600_000);
        }

        if (startAtDate.getTime() - Date.now() < 30 * 60_000) {
          startAtDate = new Date(Date.now() + 2 * 3600_000);
        }

        const booking = await BookingModel.create({
          publicId: publicId('bkg'),
          arenaId: arena._id,
          courtId: court._id,
          slotIds: [new Types.ObjectId()],
          bookerId: user._id,
          sport: sportType,
          startAt: startAtDate,
          endAt: new Date(startAtDate.getTime() + 3600_000),
          subtotalPaise: 0,
          totalPaise: 0,
          status: BookingStatus.CONFIRMED,
          source: BookingSource.APP,
          isPayAtVenue: true,
          idempotencyKey: `auto-booking:${Date.now()}:${Math.random()}`,
        });

        bookingId = String(booking._id);
      }
    }

    created(res, await service.createChallenge({
      user,
      bookingId,
      teamId,
      entryFeePaise: entryFeePaise || 0,
      ...(notes === undefined ? {} : { notes }),
    }));
  } catch (err) {
    next(err);
  }
});

/** Open-challenge feed: soonest first, which is what players actually want. */
challengeRoutes.get('/', validate({ query: feedQuery }), async (req, res, next) => {
  try {
    const q = validatedQuery<z.infer<typeof feedQuery>>(req);
    
    let arenaFilter = {};
    if (q.arenaPublicId) {
      const arena = await ArenaModel.findOne({ publicId: q.arenaPublicId, isActive: true }).lean();
      if (!arena) throw new NotFoundError('Arena');
      arenaFilter = { arenaId: arena._id };
    }

    const challenges = await ChallengeModel.find({
      status: ChallengeStatus.OPEN,
      matchExpiresAt: { $gt: new Date() },
      ...arenaFilter,
      ...(q.sport ? { sport: q.sport } : {}),
      ...(q.maxEntryFeePaise === undefined
        ? {}
        : { entryFeePaise: { $lte: q.maxEntryFeePaise } }),
    })
      .populate('creatorTeamId', 'name eloRating stats')
      .populate('creatorUserId', 'fullName')
      .populate('arenaId', 'name address')
      .sort({ startAt: 1 })
      .limit(q.limit ?? 20)
      .lean();
    ok(res, challenges);
  } catch (err) {
    next(err);
  }
});

/** Full detail with the server-computed money breakdown (money spec MM3). */
challengeRoutes.get('/:publicId', async (req, res, next) => {
  try {
    ok(res, await service.getChallengeDetail({
      challengePublicId: String(req.params.publicId),
    }));
  } catch (err) {
    next(err);
  }
});

challengeRoutes.post('/:publicId/accept', validate({ body: acceptSchema }), async (req, res, next) => {
  try {
    ok(res, await service.acceptChallenge({
      user: currentUser(req),
      challengePublicId: String(req.params.publicId),
      teamId: req.body.teamId,
    }));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Match economics (money spec MM1–MM3)
//
// One endpoint serves BOTH the creator picking a price and the opponent
// deciding whether to accept. Two implementations of this maths would
// eventually disagree, and the number a player was shown before staking money
// is the one thing that must never be wrong.
// ---------------------------------------------------------------------------

const quoteSchema = z
  .object({
    venueFeePaise: z.number().int().min(0),
    officialFeePaise: z.number().int().min(0).default(0),
    entryFeePaise: z.number().int().min(0),
    teamCount: z.number().int().min(1).max(64).default(2),
  })
  .strict();

challengeRoutes.post('/quote', validate({ body: quoteSchema }), (req, res, next) => {
  try {
    ok(res, calculateMatchMoney(req.body));
  } catch (err) {
    next(err);
  }
});
