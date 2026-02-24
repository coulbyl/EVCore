import { Injectable } from '@nestjs/common';

type NovuHealthResult = {
  configured: boolean;
  status: 'ok' | 'error' | 'not_configured';
  apiUrl: string;
  httpStatus?: number;
  error?: string;
};

type NovuTriggerResult = {
  configured: boolean;
  workflowId: string;
  acknowledged?: boolean;
  status?: string;
  transactionId?: string;
  error?: string[] | string;
};

@Injectable()
export class NovuService {
  private readonly apiUrl =
    process.env.NOVU_API_URL?.replace(/\/$/, '') ?? 'http://localhost:3010';
  private readonly apiKey = process.env.NOVU_API_KEY;

  async healthCheck(): Promise<NovuHealthResult> {
    if (!this.apiKey) {
      return {
        configured: false,
        status: 'not_configured',
        apiUrl: this.apiUrl,
      };
    }

    try {
      const response = await fetch(`${this.apiUrl}/v1/health-check`);
      return {
        configured: true,
        status: response.ok ? 'ok' : 'error',
        apiUrl: this.apiUrl,
        httpStatus: response.status,
      };
    } catch (error) {
      return {
        configured: true,
        status: 'error',
        apiUrl: this.apiUrl,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async triggerFoundationsTest(): Promise<NovuTriggerResult> {
    const workflowId =
      process.env.NOVU_WORKFLOW_ID ?? 'evcore-foundations-notification';

    if (!this.apiKey) {
      return {
        configured: false,
        workflowId,
        error: 'NOVU_API_KEY is missing',
      };
    }

    const subscriberId = process.env.NOVU_TEST_SUBSCRIBER_ID ?? 'evcore-admin';
    const testEmail = process.env.NOVU_TEST_EMAIL;

    const to = testEmail
      ? { subscriberId, email: testEmail }
      : { subscriberId };

    const response = await fetch(`${this.apiUrl}/v1/events/trigger`, {
      method: 'POST',
      headers: {
        Authorization: `ApiKey ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: workflowId,
        to,
        payload: {
          message: 'EVCore Novu foundations check',
          sentAt: new Date().toISOString(),
        },
      }),
    });

    const body = (await response.json()) as {
      acknowledged?: boolean;
      status?: string;
      transactionId?: string;
      error?: string[] | string;
    };

    return {
      configured: true,
      workflowId,
      acknowledged: body.acknowledged,
      status: body.status,
      transactionId: body.transactionId,
      error: body.error,
    };
  }
}
