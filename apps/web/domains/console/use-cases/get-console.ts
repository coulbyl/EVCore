import { cache } from "react";
import { serverApiRequest } from "@/lib/api/server-api";
import type { ConsoleStatus, PassView } from "../types/console";

/** The lights and « À faire », read once per request. */
export const getConsoleStatus = cache(
  (): Promise<ConsoleStatus> =>
    serverApiRequest<ConsoleStatus>("/console/status"),
);

/** « Les passes d'aujourd'hui ». */
export const getConsolePasses = cache(
  (): Promise<PassView[]> => serverApiRequest<PassView[]>("/console/passes"),
);
