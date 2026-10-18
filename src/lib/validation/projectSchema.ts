import { z } from 'zod';

export const ceremonyEventSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    'haldi',
    'mehndi',
    'sangeet',
    'engagement',
    'wedding',
    'reception',
    'custom',
  ]),
  name: z.string().trim().min(1, 'Event name is required').max(120),
  enabled: z.boolean(),
  date: z.string().trim().min(1, 'Event date is required').max(80),
  time: z.string().trim().min(1, 'Event time is required').max(80),
  venue: z.string().trim().min(1, 'Event venue is required').max(160),
  address: z.string().trim().max(260).optional().default(''),
  customMessage: z.string().trim().max(240).optional().default(''),
});

export const photoSlotSchema = z.object({
  url: z.string().min(1, 'Photo URL is required'),
  zoom: z.number().min(0.8).max(3.0).default(1),
  offsetX: z.number().min(-100).max(100).default(0),
  offsetY: z.number().min(-100).max(100).default(0),
  removeBg: z.boolean().optional().default(false),
  caption: z.string().optional().default(''),
});

export const musicConfigSchema = z.object({
  trackId: z.string().min(1),
  title: z.string().min(1),
  url: z.string().min(1),
  startOffsetSec: z.number().min(0).max(300).default(0),
  volume: z.number().min(0).max(1).default(0.85),
});

export const weddingProjectInputSchema = z.object({
  templateId: z.string().min(1, 'Template selection is required'),
  language: z.enum(['english', 'hindi', 'mixed']).default('mixed'),
  brideName: z
    .string()
    .trim()
    .min(1, "Bride's name is required")
    .max(120, "Bride's name is too long"),
  groomName: z
    .string()
    .trim()
    .min(1, "Groom's name is required")
    .max(120, "Groom's name is too long"),
  brideParents: z.string().trim().max(180).optional().default(''),
  groomParents: z.string().trim().max(180).optional().default(''),
  familyMessage: z.string().trim().max(500).optional().default(''),
  hashtag: z.string().trim().max(80).optional().default(''),
  contactPhone: z.string().trim().max(50).optional().default(''),
  weddingDate: z.string().trim().min(1, 'Wedding date is required').max(80),
  weddingTime: z.string().trim().min(1, 'Wedding time is required').max(80),
  weddingVenue: z.string().trim().min(1, 'Wedding venue is required').max(180),
  weddingAddress: z
    .string()
    .trim()
    .min(1, 'Full venue address is required')
    .max(300),
  mapsUrl: z.string().trim().max(400).optional().default(''),
  rsvpDetails: z.string().trim().max(240).optional().default(''),
  events: z.array(ceremonyEventSchema).default([]),
  photos: z.object({
    bride: photoSlotSchema,
    groom: photoSlotSchema,
    couple: photoSlotSchema,
    gallery: photoSlotSchema.optional(),
  }),
  music: musicConfigSchema,
  consentAccepted: z.boolean().refine((val) => val === true, {
    message: 'You must consent to processing uploaded photos for your invitation video.',
  }),
  isPublic: z.boolean().optional().default(true),
});
