/**
 * Complete WebSocket message protocol for Veltara.
 * All messages: { type, payload, timestamp }
 * Includes Zod validation schemas for every message type.
 */

import { z } from 'zod';
import type { Player, WorldState, WorldEvent, RegionId } from './types.js';

// ─── Base Schema ──────────────────────────────────────────────────────────────

const BaseMessage = z.object({
  type: z.string(),
  payload: z.unknown(),
  timestamp: z.number().int().positive(),
});

export const RegionWorldObjectSchema = z.object({
  id: z.string(),
  region_id: z.string(),
  owner_id: z.string(),
  kind: z.enum(['block', 'platform', 'beacon', 'orb']),
  material: z.enum(['stone', 'metal', 'wood', 'glass', 'neon']),
  position: z.object({
    x: z.number().min(-200).max(200),
    y: z.number().min(-100).max(100),
    z: z.number().min(-200).max(200),
  }),
  rotation: z.object({
    x: z.number().min(-Math.PI * 2).max(Math.PI * 2),
    y: z.number().min(-Math.PI * 2).max(Math.PI * 2),
    z: z.number().min(-Math.PI * 2).max(Math.PI * 2),
  }),
  scale: z.object({
    x: z.number().min(0.2).max(20),
    y: z.number().min(0.2).max(20),
    z: z.number().min(0.2).max(20),
  }),
  interactive: z.boolean(),
  metadata: z.record(z.unknown()).optional(),
  created_at: z.number(),
  updated_at: z.number(),
});

// ─── Server → Client Message Schemas ─────────────────────────────────────────

export const WorldStateMessageSchema = z.object({
  type: z.literal('world_state'),
  payload: z.object({
    planet_time: z.number(),
    day_cycle_progress: z.number().min(0).max(1),
    weather: z.enum(['clear', 'cloudy', 'stormy', 'aurora', 'solar_flare', 'void_mist']),
    active_events: z.array(
      z.object({
        id: z.string(),
        type: z.enum([
          'meteor_shower',
          'trade_caravan',
          'void_rift',
          'ancient_discovery',
          'faction_war',
          'weather_phenomenon',
        ]),
        title: z.string(),
        description: z.string(),
        region_id: z.string().nullable(),
        starts_at: z.number(),
        ends_at: z.number(),
        active: z.boolean(),
      }),
    ),
    total_online: z.number().int().nonnegative(),
    updated_at: z.number(),
  }),
  timestamp: z.number(),
});

export const PlayerJoinedMessageSchema = z.object({
  type: z.literal('player_joined'),
  payload: z.object({
    id: z.string(),
    username: z.string(),
    avatar_url: z.string().nullable(),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    action: z.string(),
    region_id: z.string(),
    color_tint: z.string(),
    connected_at: z.number(),
  }),
  timestamp: z.number(),
});

export const PlayerLeftMessageSchema = z.object({
  type: z.literal('player_left'),
  payload: z.object({
    id: z.string(),
    username: z.string(),
  }),
  timestamp: z.number(),
});

export const PositionUpdateServerSchema = z.object({
  type: z.literal('position_update'),
  payload: z.object({
    id: z.string(),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    action: z.string().max(64),
  }),
  timestamp: z.number(),
});

export const ChatMessageServerSchema = z.object({
  type: z.literal('chat_message'),
  payload: z.object({
    id: z.string(),
    user_id: z.string(),
    username: z.string(),
    avatar_url: z.string().nullable(),
    text: z.string(),
    region_id: z.string().nullable(),
    is_global: z.boolean(),
    is_npc: z.boolean().optional(),
    npc_name: z.string().optional(),
    created_at: z.number(),
  }),
  timestamp: z.number(),
});

export const RegionEventMessageSchema = z.object({
  type: z.literal('region_event'),
  payload: z.object({
    region_id: z.string(),
    event_type: z.string(),
    data: z.record(z.unknown()),
  }),
  timestamp: z.number(),
});

export const RegionObjectsSnapshotMessageSchema = z.object({
  type: z.literal('region_objects_snapshot'),
  payload: z.object({
    region_id: z.string(),
    objects: z.array(RegionWorldObjectSchema),
  }),
  timestamp: z.number(),
});

export const RegionObjectUpsertMessageSchema = z.object({
  type: z.literal('region_object_upsert'),
  payload: z.object({
    region_id: z.string(),
    object: RegionWorldObjectSchema,
    actor_id: z.string(),
  }),
  timestamp: z.number(),
});

export const RegionObjectRemoveMessageSchema = z.object({
  type: z.literal('region_object_remove'),
  payload: z.object({
    region_id: z.string(),
    object_id: z.string(),
    actor_id: z.string(),
  }),
  timestamp: z.number(),
});

export const GlobalEventMessageSchema = z.object({
  type: z.literal('global_event'),
  payload: z.object({
    id: z.string(),
    type: z.string(),
    title: z.string(),
    description: z.string(),
    region_id: z.string().nullable(),
    starts_at: z.number(),
    ends_at: z.number(),
  }),
  timestamp: z.number(),
});

export const ErrorMessageSchema = z.object({
  type: z.literal('error'),
  payload: z.object({
    code: z.string(),
    message: z.string(),
  }),
  timestamp: z.number(),
});

export const PongMessageSchema = z.object({
  type: z.literal('pong'),
  payload: z.object({ latency: z.number() }),
  timestamp: z.number(),
});

export const InitialStateMessageSchema = z.object({
  type: z.literal('initial_state'),
  payload: z.object({
    your_id: z.string(),
    region_id: z.string(),
    players: z.array(PlayerJoinedMessageSchema.shape.payload),
    chat_history: z.array(ChatMessageServerSchema.shape.payload),
    world_state: WorldStateMessageSchema.shape.payload,
    region_objects: z.array(RegionWorldObjectSchema),
  }),
  timestamp: z.number(),
});

// ─── Client → Server Message Schemas ─────────────────────────────────────────

export const PositionUpdateClientSchema = z.object({
  type: z.literal('position_update'),
  payload: z.object({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    action: z.string().max(64).default('idle'),
  }),
  timestamp: z.number(),
});

export const ChatMessageClientSchema = z.object({
  type: z.literal('chat_message'),
  payload: z.object({
    text: z.string().min(1).max(500),
    is_global: z.boolean().default(false),
  }),
  timestamp: z.number(),
});

export const RegionActionClientSchema = z.object({
  type: z.literal('region_action'),
  payload: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('object_upsert'),
      data: RegionWorldObjectSchema.partial().extend({
        id: z.string().optional(),
        kind: z.enum(['block', 'platform', 'beacon', 'orb']),
        material: z.enum(['stone', 'metal', 'wood', 'glass', 'neon']).default('stone'),
        position: RegionWorldObjectSchema.shape.position,
        rotation: RegionWorldObjectSchema.shape.rotation.optional(),
        scale: RegionWorldObjectSchema.shape.scale.optional(),
        interactive: z.boolean().optional(),
        metadata: z.record(z.unknown()).optional(),
      }),
    }),
    z.object({
      type: z.literal('object_remove'),
      data: z.object({
        object_id: z.string(),
      }),
    }),
    z.object({
      type: z.literal('object_interact'),
      data: z.object({
        object_id: z.string(),
        interaction_type: z.string().min(1).max(64),
        payload: z.record(z.unknown()).optional(),
      }),
    }),
  ]),
  timestamp: z.number(),
});

export const PingMessageSchema = z.object({
  type: z.literal('ping'),
  payload: z.object({ client_time: z.number() }),
  timestamp: z.number(),
});

// ─── Discriminated Union Schemas ──────────────────────────────────────────────

export const ServerMessageSchema = z.discriminatedUnion('type', [
  WorldStateMessageSchema,
  PlayerJoinedMessageSchema,
  PlayerLeftMessageSchema,
  PositionUpdateServerSchema,
  ChatMessageServerSchema,
  RegionEventMessageSchema,
  RegionObjectsSnapshotMessageSchema,
  RegionObjectUpsertMessageSchema,
  RegionObjectRemoveMessageSchema,
  GlobalEventMessageSchema,
  ErrorMessageSchema,
  PongMessageSchema,
  InitialStateMessageSchema,
]);

export const ClientMessageSchema = z.discriminatedUnion('type', [
  PositionUpdateClientSchema,
  ChatMessageClientSchema,
  RegionActionClientSchema,
  PingMessageSchema,
]);

// ─── TypeScript Types ─────────────────────────────────────────────────────────

export type WorldStateMessage = z.infer<typeof WorldStateMessageSchema>;
export type PlayerJoinedMessage = z.infer<typeof PlayerJoinedMessageSchema>;
export type PlayerLeftMessage = z.infer<typeof PlayerLeftMessageSchema>;
export type PositionUpdateServerMessage = z.infer<typeof PositionUpdateServerSchema>;
export type ChatMessageServer = z.infer<typeof ChatMessageServerSchema>;
export type RegionEventMessage = z.infer<typeof RegionEventMessageSchema>;
export type RegionObjectsSnapshotMessage = z.infer<typeof RegionObjectsSnapshotMessageSchema>;
export type RegionObjectUpsertMessage = z.infer<typeof RegionObjectUpsertMessageSchema>;
export type RegionObjectRemoveMessage = z.infer<typeof RegionObjectRemoveMessageSchema>;
export type GlobalEventMessage = z.infer<typeof GlobalEventMessageSchema>;
export type ErrorMessage = z.infer<typeof ErrorMessageSchema>;
export type PongMessage = z.infer<typeof PongMessageSchema>;
export type InitialStateMessage = z.infer<typeof InitialStateMessageSchema>;

export type PositionUpdateClientMessage = z.infer<typeof PositionUpdateClientSchema>;
export type ChatMessageClient = z.infer<typeof ChatMessageClientSchema>;
export type RegionActionMessage = z.infer<typeof RegionActionClientSchema>;
export type PingMessage = z.infer<typeof PingMessageSchema>;

export type ServerMessage = z.infer<typeof ServerMessageSchema>;
export type ClientMessage = z.infer<typeof ClientMessageSchema>;
export type RegionWorldObjectProtocol = z.infer<typeof RegionWorldObjectSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Creates a server message with the current timestamp.
 */
export function makeServerMessage<T extends ServerMessage>(
  msg: Omit<T, 'timestamp'>,
): T {
  return { ...msg, timestamp: Date.now() } as T;
}

/**
 * Safely parses and validates an incoming client WebSocket message.
 * Returns null if invalid.
 */
export function parseClientMessage(raw: string): ClientMessage | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    const result = ClientMessageSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * Safely parses and validates an incoming server WebSocket message.
 */
export function parseServerMessage(raw: string): ServerMessage | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    const result = ServerMessageSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
