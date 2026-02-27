import { z } from 'zod';

// Understat injects match data as JSON-encoded strings in page <script> tags.
// Each match entry has h_xg / a_xg as string-encoded floats.
export const XgMatchSchema = z
  .object({
    h_id: z.string().min(1),
    a_id: z.string().min(1),
    // Understat datetime: "2022-08-06 12:30:00"
    datetime: z.string().min(10),
    h: z.object({ title: z.string().min(1) }),
    a: z.object({ title: z.string().min(1) }),
    h_xg: z
      .string()
      .regex(/^\d+(\.\d+)?$/, 'xG must be a non-negative numeric string')
      .transform(Number),
    a_xg: z
      .string()
      .regex(/^\d+(\.\d+)?$/, 'xG must be a non-negative numeric string')
      .transform(Number),
  })
  .refine((d) => d.h_xg >= 0 && d.h_xg <= 10, {
    message: 'xG home is out of valid range [0, 10]',
    path: ['h_xg'],
  })
  .refine((d) => d.a_xg >= 0 && d.a_xg <= 10, {
    message: 'xG away is out of valid range [0, 10]',
    path: ['a_xg'],
  });

export const UnderstatSeasonSchema = z.array(XgMatchSchema);

export type XgMatch = z.infer<typeof XgMatchSchema>;
