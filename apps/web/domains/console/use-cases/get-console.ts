import { cache } from "react";
import { serverApiRequest } from "@/lib/api/server-api";
import type {
  ChannelCell,
  ConsoleStatus,
  EngineProducts,
  PassView,
  SuspendedMarket,
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
