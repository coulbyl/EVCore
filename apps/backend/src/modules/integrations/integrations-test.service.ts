import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import webpush from 'web-push';
import { INTEGRATIONS, type IntegrationKey } from '@evcore/db';
import { ETL_CONSTANTS } from '@config/etl.constants';
import { IntegrationsService } from './integrations.service';
import type { IntegrationTestResult } from './integrations.types';

const TIMEOUT_MS = 8_000;

/**
 * The OpenAI-compatible providers' model lists: a key is good when the list
 * answers. A GET with the key, never a completion — the backend stays
 * LLM-agnostic, the worker alone calls a model.
 */
const LLM_MODELS_URL: Record<
  'groq' | 'cerebras' | 'together' | 'fireworks',
  string
> = {
  groq: 'https://api.groq.com/openai/v1/models',
  cerebras: 'https://api.cerebras.ai/v1/models',
  together: 'https://api.together.xyz/v1/models',
  fireworks: 'https://api.fireworks.ai/inference/v1/models',
};

const fail = (detail: string): IntegrationTestResult => ({ ok: false, detail });

/**
 * « Tester la connexion » (Réglages › Intégrations): one light call per
 * service with the values that serve (stored, else the environment), and
 * the outcome in a few words. Nothing is written anywhere.
 */
@Injectable()
export class IntegrationsTestService {
  constructor(
    private readonly integrations: IntegrationsService,
    private readonly config: ConfigService,
  ) {}

  async test(key: string): Promise<IntegrationTestResult> {
    const integration = INTEGRATIONS.find((i) => i.key === key);
    if (!integration) throw new BadRequestException('Intégration inconnue');
    try {
      return await this.run(integration.key);
    } catch (err) {
      return fail(err instanceof Error ? err.message.slice(0, 160) : 'échec');
    }
  }

  private async run(key: IntegrationKey): Promise<IntegrationTestResult> {
    const get = (field: string) => this.integrations.get(`${key}.${field}`);
    switch (key) {
      case 'apiFootball': {
        const apiKey = await get('key');
        if (!apiKey) return fail('pas de clé');
        const res = await fetch(`${ETL_CONSTANTS.API_FOOTBALL_BASE}/status`, {
          headers: { 'x-apisports-key': apiKey },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        const body = (await res.json()) as {
          errors?: unknown;
          response?: { requests?: { current?: number; limit_day?: number } };
        };
        const errors =
          body.errors && typeof body.errors === 'object'
            ? Object.values(body.errors as Record<string, string>)
            : [];
        if (!res.ok || errors.length > 0) {
          return fail(errors.join(' · ') || `HTTP ${res.status}`);
        }
        const r = body.response?.requests;
        return {
          ok: true,
          detail: `quota ${r?.current ?? '?'} / ${r?.limit_day ?? '?'}`,
        };
      }
      case 'theOddsApi': {
        const apiKey = await get('key');
        if (!apiKey) return fail('pas de clé');
        const res = await fetch(
          `${ETL_CONSTANTS.THE_ODDS_API_BASE}/sports?apiKey=${encodeURIComponent(apiKey)}`,
          { signal: AbortSignal.timeout(TIMEOUT_MS) },
        );
        if (!res.ok) return fail(`HTTP ${res.status}`);
        return {
          ok: true,
          detail: `crédits restants ${res.headers.get('x-requests-remaining') ?? '?'}`,
        };
      }
      case 'email': {
        const apiKey = await get('apiKey');
        if (!apiKey) return fail('pas de clé');
        const res = await fetch('https://api.resend.com/domains', {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) return fail(`HTTP ${res.status}`);
        const body = (await res.json()) as {
          data?: { name: string; status: string }[];
        };
        const from = (await get('from')) ?? '';
        const domain = from.split('@')[1]?.replace(/>$/, '');
        const match = body.data?.find((d) => d.name === domain);
        if (domain && !match) return fail(`domaine ${domain} absent de Resend`);
        if (match && match.status !== 'verified') {
          return fail(`domaine ${match.name} : ${match.status}`);
        }
        return {
          ok: true,
          detail: match ? `domaine ${match.name} vérifié` : 'clé valide',
        };
      }
      case 'push': {
        const [publicKey, privateKey, subject] = await Promise.all([
          get('publicKey'),
          get('privateKey'),
          get('subject'),
        ]);
        if (!publicKey || !privateKey || !subject)
          return fail('champ manquant');
        // Validates the keys' format and the contact, without sending.
        webpush.setVapidDetails(subject, publicKey, privateKey);
        return { ok: true, detail: 'clés valides' };
      }
      case 'storage': {
        const [endpoint, region, bucket] = await Promise.all([
          get('endpoint'),
          get('region'),
          get('bucket'),
        ]);
        // The access keys are read from the .env only (storage.service.ts).
        const accessKeyId = this.config.get<string>('RUSTFS_ACCESS_KEY');
        const secretAccessKey = this.config.get<string>('RUSTFS_SECRET_KEY');
        if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
          return fail('champ manquant');
        }
        const client = new S3Client({
          endpoint,
          region: region ?? 'us-east-1',
          credentials: { accessKeyId, secretAccessKey },
          forcePathStyle: true,
        });
        try {
          await client.send(new HeadBucketCommand({ Bucket: bucket }), {
            abortSignal: AbortSignal.timeout(TIMEOUT_MS),
          });
        } finally {
          client.destroy();
        }
        return { ok: true, detail: `bucket ${bucket} lisible` };
      }
      case 'groq':
      case 'cerebras':
      case 'together':
      case 'fireworks': {
        const apiKey = await get('apiKey');
        if (!apiKey) return fail('pas de clé');
        const res = await fetch(LLM_MODELS_URL[key], {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) return fail(`HTTP ${res.status}`);
        const body = (await res.json()) as { data?: unknown[] };
        return { ok: true, detail: `${body.data?.length ?? 0} modèles` };
      }
      case 'tavily': {
        const apiKey = await get('apiKey');
        if (!apiKey) return fail('pas de clé');
        // The lightest call Tavily has: one result (one credit).
        const res = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: 'football', max_results: 1 }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        return res.ok
          ? { ok: true, detail: 'clé valide' }
          : fail(`HTTP ${res.status}`);
      }
    }
  }
}
