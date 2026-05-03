import { Injectable } from '@nestjs/common';
import { FormationContentType } from '@evcore/db';
import { GamificationService } from '@modules/gamification/gamification.service';
import { FormationProgressRepository } from './formation-progress.repository';

@Injectable()
export class FormationProgressService {
  constructor(
    private readonly repo: FormationProgressRepository,
    private readonly gamification: GamificationService,
  ) {}

  list(userId: string) {
    return this.repo.list(userId);
  }

  async upsert(input: {
    userId: string;
    contentType: FormationContentType;
    slug: string;
  }) {
    const progress = await this.repo.upsert(input);
    await this.gamification.checkFormationGraduateBadge(input.userId);
    return progress;
  }

  remove(input: {
    userId: string;
    contentType: FormationContentType;
    slug: string;
  }) {
    return this.repo.remove(input);
  }
}
