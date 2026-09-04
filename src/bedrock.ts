export type PackMode = 'resource' | 'behavior';

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
  createdAt: string;
  updatedAt: string;
};

export const CURRENT_BEDROCK_VERSION: [number, number, number] = [1, 26, 40];
export const BLOCK_FORMAT_VERSION = '1.26.40';

export function makePackIds(): PackIds {
  return {
    behaviorHeader: crypto.randomUUID(),
    behaviorModule: crypto.randomUUID(),
    resourceHeader: crypto.randomUUID(),
    resourceModule: crypto.randomUUID(),
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
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
}

export function createBlockDraft(namespace: string): BlockDefinition {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
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

export function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}
