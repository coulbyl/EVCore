export type TechnicalDocSummary = {
  slug: string;
  title: string;
  order: number;
};

export type TechnicalDoc = TechnicalDocSummary & {
  content: string;
};
