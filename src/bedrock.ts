export type PackMode = 'resource' | 'behavior';
export type TextureKind = 'item' | 'block';
export type ItemCategory = 'construction' | 'nature' | 'equipment' | 'items' | 'none';

export type PackIds = {
  behaviorHeader: string;
  behaviorModule: string;
  resourceHeader: string;
  resourceModule: string;
};

export type BlockDefinition = {
  id: string;
  name: string;
  identifier: string;
  texture: string;
  geometry: string;
  secondsToDestroy: number;
  explosionResistance: number;
  friction: number;
  lightEmission: number;
  mapColor: string;
  collision: boolean;
  selection: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ItemDefinition = {
  id: string;
  name: string;
  identifier: string;
  texture: string;
  category: ItemCategory;
  maxStackSize: number;
  glint: boolean;
  handEquipped: boolean;
  fireResistant: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TextureDefinition = {
  id: string;
  key: string;
  kind: TextureKind;
  fileName: string;
  width: number;
  height: number;
  size: number;
  dataUrl: string;
  createdAt: string;
};

export type Project = {
  id: string;
  name: string;
  namespace: string;
  description: string;
  version: [number, number, number];
  minEngineVersion: [number, number, number];
  packs: PackMode[];
  packIds: PackIds;
  blocks: BlockDefinition[];
  items: ItemDefinition[];
  textures: TextureDefinition[];
  createdAt: string;
  updatedAt: string;
};

export const CURRENT_BEDROCK_VERSION: [number, number, number] = [1, 26, 40];
export const BLOCK_FORMAT_VERSION = '1.26.40';
export const ITEM_FORMAT_VERSION = '1.26.40';

export function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return `bs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function makePackIds(): PackIds {
  return {
    behaviorHeader: createId(),
    behaviorModule: createId(),
    resourceHeader: createId(),
    resourceModule: createId(),
  };
}

export function normalizeNamespace(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function normalizePathName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9_.-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function migrateProject(input: Partial<Project> & { id: string; name: string; namespace: string }): Project {
  const now = new Date().toISOString();
  return {
    id: input.id,
    name: input.name,
    namespace: normalizeNamespace(input.namespace),
    description: input.description ?? `${input.name} created with Bedrock Studio`,
    version: input.version ?? [0, 1, 0],
    minEngineVersion: input.minEngineVersion ?? CURRENT_BEDROCK_VERSION,
    packs: input.packs?.length ? input.packs : ['resource', 'behavior'],
    packIds: input.packIds ?? makePackIds(),
    blocks: input.blocks ?? [],
    items: input.items ?? [],
    textures: input.textures ?? [],
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
}

export function createBlockDraft(namespace: string): BlockDefinition {
  const now = new Date().toISOString();
  return {
    id: createId(),
    name: 'New Block',
    identifier: `${namespace}:new_block`,
    texture: 'new_block',
    geometry: '',
    secondsToDestroy: 1,
    explosionResistance: 4,
    friction: 0.6,
    lightEmission: 0,
    mapColor: '#808080',
    collision: true,
    selection: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function createItemDraft(namespace: string, texture = ''): ItemDefinition {
  const now = new Date().toISOString();
  return {
    id: createId(),
    name: 'New Item',
    identifier: `${namespace}:new_item`,
    texture,
    category: 'items',
    maxStackSize: 64,
    glint: false,
    handEquipped: false,
    fireResistant: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function validateBlock(block: BlockDefinition, project: Project): string[] {
  const errors: string[] = [];
  const identifierPattern = /^[a-z0-9_]+:[a-z0-9_.-]+$/;

  if (!block.name.trim()) errors.push('Display name is required.');
  if (!identifierPattern.test(block.identifier)) {
    errors.push('Identifier must look like namespace:block_name using lowercase letters, numbers, _, . or -.');
  }
  if (!block.identifier.startsWith(`${project.namespace}:`)) {
    errors.push(`Identifier should use this project's namespace: ${project.namespace}:`);
  }
  if (block.secondsToDestroy < 0) errors.push('Mining time cannot be negative.');
  if (block.explosionResistance < 0) errors.push('Explosion resistance cannot be negative.');
  if (block.friction < 0 || block.friction > 0.9) errors.push('Friction must be between 0 and 0.9.');
  if (!Number.isInteger(block.lightEmission) || block.lightEmission < 0 || block.lightEmission > 15) {
    errors.push('Light emission must be a whole number from 0 to 15.');
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(block.mapColor)) errors.push('Map color must be a 6-digit hex color.');
  if (block.geometry && !block.geometry.startsWith('geometry.')) errors.push('Geometry identifiers should begin with geometry.');

  return errors;
}

export function validateItem(item: ItemDefinition, project: Project): string[] {
  const errors: string[] = [];
  const identifierPattern = /^[a-z0-9_]+:[a-z0-9_.-]+$/;

  if (!item.name.trim()) errors.push('Display name is required.');
  if (!identifierPattern.test(item.identifier)) {
    errors.push('Identifier must look like namespace:item_name using lowercase letters, numbers, _, . or -.');
  }
  if (!item.identifier.startsWith(`${project.namespace}:`)) {
    errors.push(`Identifier should use this project's namespace: ${project.namespace}:`);
  }
  if (!item.texture.trim()) errors.push('Choose or enter an item texture key.');
  if (!Number.isInteger(item.maxStackSize) || item.maxStackSize < 1 || item.maxStackSize > 64) {
    errors.push('Max stack size must be a whole number from 1 to 64.');
  }
  return errors;
}

export function generateBehaviorManifest(project: Project) {
  const manifest: Record<string, unknown> = {
    format_version: 2,
    header: {
      name: `${project.name} BP`,
      description: project.description,
      uuid: project.packIds.behaviorHeader,
      version: project.version,
      min_engine_version: project.minEngineVersion,
    },
    modules: [
      {
        type: 'data',
        uuid: project.packIds.behaviorModule,
        version: project.version,
        description: `${project.name} behavior data`,
      },
    ],
  };

  if (project.packs.includes('resource')) {
    manifest.dependencies = [
      {
        uuid: project.packIds.resourceHeader,
        version: project.version,
      },
    ];
  }

  return manifest;
}

export function generateResourceManifest(project: Project) {
  return {
    format_version: 2,
    header: {
      name: `${project.name} RP`,
      description: project.description,
      uuid: project.packIds.resourceHeader,
      version: project.version,
      min_engine_version: project.minEngineVersion,
    },
    modules: [
      {
        type: 'resources',
        uuid: project.packIds.resourceModule,
        version: project.version,
        description: `${project.name} resources`,
      },
    ],
  };
}

export function generateBlockJson(block: BlockDefinition) {
  const components: Record<string, unknown> = {
    'minecraft:destructible_by_mining': {
      seconds_to_destroy: block.secondsToDestroy,
    },
    'minecraft:destructible_by_explosion': {
      explosion_resistance: block.explosionResistance,
    },
    'minecraft:friction': block.friction,
    'minecraft:map_color': block.mapColor,
    'minecraft:collision_box': block.collision,
    'minecraft:selection_box': block.selection,
  };

  if (block.lightEmission > 0) components['minecraft:light_emission'] = block.lightEmission;
  if (block.texture) {
    components['minecraft:material_instances'] = {
      '*': {
        texture: block.texture,
        render_method: 'opaque',
      },
    };
  }
  if (block.geometry) components['minecraft:geometry'] = block.geometry;

  return {
    format_version: BLOCK_FORMAT_VERSION,
    'minecraft:block': {
      description: {
        identifier: block.identifier,
        menu_category: {
          category: 'construction',
        },
      },
      components,
    },
  };
}

export function generateItemJson(item: ItemDefinition) {
  const components: Record<string, unknown> = {
    'minecraft:icon': {
      texture: item.texture,
    },
    'minecraft:display_name': {
      value: item.name,
    },
    'minecraft:max_stack_size': item.maxStackSize,
  };

  if (item.glint) components['minecraft:glint'] = true;
  if (item.handEquipped) components['minecraft:hand_equipped'] = true;
  if (item.fireResistant) components['minecraft:fire_resistant'] = true;

  return {
    format_version: ITEM_FORMAT_VERSION,
    'minecraft:item': {
      description: {
        identifier: item.identifier,
        menu_category: {
          category: item.category,
        },
      },
      components,
    },
  };
}

export function generateItemTextureAtlas(project: Project) {
  const textureData: Record<string, { textures: string }> = {};
  for (const texture of project.textures.filter((entry) => entry.kind === 'item')) {
    textureData[texture.key] = {
      textures: `textures/items/${normalizePathName(texture.fileName)}`,
    };
  }

  return {
    resource_pack_name: `${project.name} RP`,
    texture_name: 'atlas.items',
    texture_data: textureData,
  };
}

export function generateTerrainTextureAtlas(project: Project) {
  const textureData: Record<string, { textures: string }> = {};
  for (const texture of project.textures.filter((entry) => entry.kind === 'block')) {
    textureData[texture.key] = {
      textures: `textures/blocks/${normalizePathName(texture.fileName)}`,
    };
  }

  return {
    resource_pack_name: `${project.name} RP`,
    texture_name: 'atlas.terrain',
    padding: 8,
    num_mip_levels: 4,
    texture_data: textureData,
  };
}

export function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}
