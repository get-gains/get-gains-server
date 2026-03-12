import { z } from 'zod';

// ── Equip Body ──

export const EquipBodySchema = z.object({
  body: z.object({
    cosmeticId: z.string().min(1, 'Cosmetic ID is required'),
  }),
});

export type EquipBody = z.infer<typeof EquipBodySchema>['body'];

// ── Unequip Body ──

export const UnequipBodySchema = z.object({
  body: z.object({
    category: z.enum(['HEADWEAR', 'TOP', 'BOTTOM', 'ACCESSORY']),
  }),
});

export type UnequipBody = z.infer<typeof UnequipBodySchema>['body'];
