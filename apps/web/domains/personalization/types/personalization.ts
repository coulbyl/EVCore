import type { ChannelStatus } from "@/domains/dashboard/types/dashboard";

export type FollowedChannel = {
  channel: string;
  since: string;
};

export type FollowedLeague = {
  code: string;
  name: string;
  country: string;
  since: string;
};

export type Personalization = {
  followedChannels: FollowedChannel[];
  followedLeagues: FollowedLeague[];
};

export type LeagueCatalogItem = {
  code: string;
  name: string;
  country: string;
};

export type DiscoverableChannel = {
  channel: string;
  status: ChannelStatus;
  sampleSize: number;
  followed: boolean;
};
