import { z } from 'zod';

const socialLinkSchema = z.preprocess((val) => {
  if (
    typeof val === 'string' &&
    !val.startsWith('http://') &&
    !val.startsWith('https://')
  ) {
    return `https://${val}`;
  }
  return val;
}, z.string().url('Social link must be a valid URL'));

export const CreatePartnerSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Partner name is required'),
    bio: z.string().min(1, 'Bio is required'),
    logoKey: z.string(),
    socialLinks: z.array(socialLinkSchema).default([]),
  }),
});
export type CreatePartnerBody = z.infer<typeof CreatePartnerSchema>['body'];

export const UpdatePartnerSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Partner ID is required'),
  }),
  body: z.object({
    name: z.string().min(1, 'Partner name is required').optional(),
    bio: z.string().min(1, 'Bio is required').optional(),
    logoKey: z.string().min(1, 'Logo key is required').optional(),
    socialLinks: z.array(socialLinkSchema).optional(),
  }),
});
export type UpdatePartnerParams = z.infer<typeof UpdatePartnerSchema>['params'];
export type UpdatePartnerBody = z.infer<typeof UpdatePartnerSchema>['body'];

export const PartnerIdParamsSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Partner ID is required'),
  }),
});
export type PartnerIdParams = z.infer<typeof PartnerIdParamsSchema>['params'];

export const ListPartnersQuerySchema = z.object({
  query: z.object({
    search: z.string().optional(),
    limit: z.preprocess(
      (val) => (val === undefined ? 20 : Number(val)),
      z.number().int().min(1).max(100)
    ),
    offset: z.preprocess(
      (val) => (val === undefined ? 0 : Number(val)),
      z.number().int().min(0)
    ),
  }),
});
export type ListPartnersQuery = z.infer<
  typeof ListPartnersQuerySchema
>['query'];
