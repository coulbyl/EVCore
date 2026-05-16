import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { PrismaService } from '@/prisma.service';
import { seasonNameFromYear } from '@utils/season.utils';
import { StandingRepository } from './standing.repository';

type StandingTeam = {
  rank: number;
  teamApiId: number;
  teamName: string;
  teamLogo: string;
  played: number;
  win: number;
  draw: number;
  lose: number;
  goalsFor: number;
  goalsAgainst: number;
  goalsDiff: number;
  points: number;
  form: string | null;
  description: string | null;
};

type StandingGroup = {
  name: string;
  teams: StandingTeam[];
};

type StandingsResponse = {
  competition: string;
  season: string;
  groups: StandingGroup[];
};

@ApiTags('Standings')
@Controller('standings')
@UseGuards(AuthSessionGuard)
export class StandingController {
  constructor(
    private readonly standingRepository: StandingRepository,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get group standings for a competition and season' })
  @ApiQuery({ name: 'competition', example: 'WC26' })
  @ApiQuery({ name: 'season', example: '2026' })
  @ApiOkResponse({ description: 'Groups A–L with ranked teams.' })
  async getStandings(
    @Query('competition') competitionCode?: string,
    @Query('season') seasonParam?: string,
  ): Promise<StandingsResponse> {
    if (!competitionCode) {
      throw new BadRequestException('competition query param is required');
    }
    if (!seasonParam) {
      throw new BadRequestException('season query param is required');
    }

    const seasonYear = Number.parseInt(seasonParam, 10);
    if (Number.isNaN(seasonYear)) {
      throw new BadRequestException('season must be a valid year');
    }

    const competition = await this.prisma.client.competition.findUnique({
      where: { code: competitionCode.toUpperCase() },
    });
    if (!competition) {
      throw new NotFoundException(`Competition ${competitionCode} not found`);
    }

    const seasonName = seasonNameFromYear(seasonYear);

    const season = await this.prisma.client.season.findUnique({
      where: {
        competitionId_name: {
          competitionId: competition.id,
          name: seasonName,
        },
      },
    });
    if (!season) {
      throw new NotFoundException(
        `No standings found for ${competitionCode} ${seasonParam} — run the standings sync first`,
      );
    }

    const rows = await this.standingRepository.findByCompetitionAndSeason(
      competition.id,
      season.id,
    );

    // Group rows by group name
    const groupMap = new Map<string, StandingTeam[]>();
    for (const row of rows) {
      const existing = groupMap.get(row.group) ?? [];
      existing.push({
        rank: row.rank,
        teamApiId: row.teamApiId,
        teamName: row.teamName,
        teamLogo: row.teamLogo,
        played: row.played,
        win: row.win,
        draw: row.draw,
        lose: row.lose,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        goalsDiff: row.goalsDiff,
        points: row.points,
        form: row.form,
        description: row.description,
      });
      groupMap.set(row.group, existing);
    }

    const groups: StandingGroup[] = Array.from(groupMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, teams]) => ({ name, teams }));

    return { competition: competition.code, season: season.name, groups };
  }
}
