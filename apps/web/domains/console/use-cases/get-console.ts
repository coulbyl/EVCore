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
