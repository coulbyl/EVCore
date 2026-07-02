import { describe, expect, it } from 'vitest';
import {
  buildEvaAnalysisSystemPrompt,
  buildEvaAnalysisUserPrompt,
} from './analysis-sheet.prompt';

describe('buildEvaAnalysisSystemPrompt', () => {
  const prompt = buildEvaAnalysisSystemPrompt();

  it('states the anti-hallucination rule', () => {
    expect(prompt).toContain('JAMAIS une cote');
  });

  it('forbids Eva from doing arithmetic itself', () => {
    expect(prompt).toContain('Tu ne fais JAMAIS d');
  });

  it('forbids unsolicited disclaimers', () => {
    expect(prompt).toContain('Pas de disclaimer generique');
  });

  it('states the coherence-spotting task', () => {
    expect(prompt).toContain('coherences et incoherences');
  });
});

describe('buildEvaAnalysisUserPrompt', () => {
  it('embeds the sheet content verbatim without mutation', () => {
    const sheet = "FICHE D'ANALYSE EVCORE — test content";
    const prompt = buildEvaAnalysisUserPrompt(sheet);
    expect(prompt).toContain(sheet);
  });
});
