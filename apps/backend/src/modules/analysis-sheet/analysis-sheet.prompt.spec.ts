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

  it('states the incoherence-spotting task and requires concrete evidence', () => {
    expect(prompt).toContain('incoherences concretes et verifiables');
    expect(prompt).toContain('jamais de rapprochement vague');
  });

  it('makes the engine-computed vigilance section the only source of truth', () => {
    expect(prompt).toContain('=== Vigilance ===');
    expect(prompt).toContain('liste EXHAUSTIVE');
    expect(prompt).toContain('ni plus, ni moins');
  });

  it('requires probability + odds + EV together and a speculative label under 50%', () => {
    expect(prompt).toContain('probabilite, sa cote et son EV');
    expect(prompt).toContain('inferieure a 50%');
    expect(prompt).toContain('speculatif');
  });

  it('requires cross-channel arbitration on a shared fixture', () => {
    expect(prompt).toContain('compare-les (probabilite ET EV)');
  });

  it('forbids observation-only CORRECT_SCORE picks in best picks', () => {
    expect(prompt).toContain('jamais misé');
    expect(prompt).toContain('CORRECT_SCORE');
  });

  it('flags half-time markets as fragile and model probabilities as optimistic', () => {
    expect(prompt).toContain('marches mi-temps');
    expect(prompt).toContain('historiquement optimistes');
  });

  it('defines the coupon task and the machine-readable block contract', () => {
    expect(prompt).toContain('Compose 1 a 2 coupons');
    expect(prompt).toContain('```evcore-coupons');
    expect(prompt).toContain('fixtureId');
    // Coupon arithmetic belongs to the engine, never to Eva.
    expect(prompt).toContain(
      'Le moteur recalcule et affiche lui-meme cotes totales, mises et gains',
    );
  });
});

describe('buildEvaAnalysisUserPrompt', () => {
  it('embeds the sheet content verbatim without mutation', () => {
    const sheet = "FICHE D'ANALYSE EVCORE — test content";
    const prompt = buildEvaAnalysisUserPrompt({ sheet });
    expect(prompt).toContain(sheet);
    expect(prompt).not.toContain('Objectif de gain net');
  });

  it('appends the target win amount when provided', () => {
    const prompt = buildEvaAnalysisUserPrompt({
      sheet: 'fiche',
      targetWinAmount: 300_000,
    });
    expect(prompt).toContain("Objectif de gain net de l'utilisateur : 300000");
  });
});
