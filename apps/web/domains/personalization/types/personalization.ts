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
  calibrationRatio: number | null;
  sampleSize: number;
  proven: boolean;
  followed: boolean;
};
