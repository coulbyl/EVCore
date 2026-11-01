import { cache } from "react";
import { serverApiRequest } from "@/lib/api/server-api";
import type {
  ChannelCell,
  ConsoleStatus,
  EngineProducts,
  PassView,
  SuspendedMarket,
  PlayersMonth,
  PlayerAccount,
  PlayerSheet,
  AnnouncementView,
  SettingView,
  AdminActionView,
  QueuesScreen,
  SettlePreview,
} from "../types/console";

/** The lights and « À faire », read once per request. */
export const getConsoleStatus = cache(
  (): Promise<ConsoleStatus> =>
    serverApiRequest<ConsoleStatus>("/console/status"),
);

/** « Les passes d'aujourd'hui ». */
export const getConsolePasses = cache(
  (): Promise<PassView[]> => serverApiRequest<PassView[]>("/console/passes"),
);

/** Moteur › Produits over a period (30, 90, all). */
export const getEngineProducts = cache(
  (period: string): Promise<EngineProducts> =>
    serverApiRequest<EngineProducts>(
      `/console/engine/products?period=${period}`,
    ),
);

/** Moteur › Canaux × compétition, 90 rolling days. */
export const getEngineChannels = cache(
  (): Promise<ChannelCell[]> =>
    serverApiRequest<ChannelCell[]>("/console/engine/channels"),
);

/** Moteur › Marchés suspendus. */
export const getSuspensions = cache(
  (): Promise<SuspendedMarket[]> =>
    serverApiRequest<SuspendedMarket[]>("/console/engine/suspensions"),
);

export const getPlayersMonth = cache(
  (month?: string): Promise<PlayersMonth> =>
    serverApiRequest<PlayersMonth>(
      month
        ? `/console/players/month?month=${month}`
        : "/console/players/month",
    ),
);

export const getAccounts = cache(
  (
    q: string,
    page: number,
  ): Promise<{ items: PlayerAccount[]; page: number; more: boolean }> =>
    serverApiRequest(
      `/console/players/accounts?page=${page}${q ? `&q=${encodeURIComponent(q)}` : ""}`,
    ),
);

export const getPlayer = cache(
  (id: string): Promise<PlayerSheet> =>
    serverApiRequest<PlayerSheet>(`/console/players/${id}`),
);

export const getAnnouncements = cache(
  (): Promise<AnnouncementView[]> =>
    serverApiRequest<AnnouncementView[]>("/admin/announcements"),
);

/** Réglages: the five operator settings. */
export const getSettings = cache(
  (): Promise<SettingView[]> =>
    serverApiRequest<SettingView[]>("/console/settings"),
);

/** The human-actions journal, optionally one person's. */
export const getJournal = cache(
  (
    actor?: string,
  ): Promise<{
    items: AdminActionView[];
    actors: { id: string; name: string }[];
  }> =>
    serverApiRequest(
      actor
        ? `/console/journal?actor=${encodeURIComponent(actor)}`
        : "/console/journal",
    ),
);

/** Exploitation › Les files, read fresh each time (no cache: it moves). */
export const getQueues = cache(
  (): Promise<QueuesScreen> =>
    serverApiRequest<QueuesScreen>("/console/queues"),
);

/** The last settlement replay, read through an empty preview of today. */
export const getLastSettle = cache(
  (today: string): Promise<SettlePreview> =>
    serverApiRequest<SettlePreview>(
      `/console/settle/preview?kind=coupons&from=${today}&to=${today}`,
    ),
);
