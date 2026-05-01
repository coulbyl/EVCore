import { Injectable } from '@nestjs/common';
import { FormationContentType } from '@evcore/db';
import { FormationProgressRepository } from './formation-progress.repository';

@Injectable()
export class FormationProgressService {
  constructor(private readonly repo: FormationProgressRepository) {}

  list(userId: string) {
    return this.repo.list(userId);
  }

  upsert(input: {
    userId: string;
    contentType: FormationContentType;
    slug: string;
  }) {
    return this.repo.upsert(input);
  }

  remove(input: {
    userId: string;
    contentType: FormationContentType;
    slug: string;
  }) {
    return this.repo.remove(input);
  }
}
