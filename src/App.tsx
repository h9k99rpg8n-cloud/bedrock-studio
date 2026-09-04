import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import {
  BlockDefinition,
  CURRENT_BEDROCK_VERSION,
  ItemDefinition,
  Project,
  TextureDefinition,
  TextureKind,
  createBlockDraft,
  createId,
  createItemDraft,
  generateBehaviorManifest,
  generateBlockJson,
  generateItemJson,
  generateItemTextureAtlas,
  generateResourceManifest,
  generateTerrainTextureAtlas,
  makePackIds,
  migrateProject,
  normalizeNamespace,
  normalizePathName,
  prettyJson,
  validateBlock,
  validateItem,
} from './bedrock';

type View = 'dashboard' | 'blocks' | 'block-editor' | 'items' | 'item-editor' | 'textures' | 'technical';
type TechnicalTab = 'behavior' | 'resource' | 'item-textures' | 'terrain-textures';

const PROJECT_STORAGE_KEY = 'bedrock-studio.projects';
const MAX_TEXTURE_BYTES = 512 * 1024;

function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(PROJECT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<Partial<Project> & { id: string; name: string; namespace: string }>;
    const migrated = parsed.map(migrateProject);
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  } catch {
    return [];
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function getImageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('Could not read PNG dimensions.'));
    image.src = dataUrl;
  });
}

function App() {
  const initialProjects = useMemo(loadProjects, []);
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialProjects[0]?.id ?? null);
  const [view, setView] = useState<View>('dashboard');
  const [showCreate, setShowCreate] = useState(false);
  const [blockDraft, setBlockDraft] = useState<BlockDefinition | null>(null);
  const [itemDraft, setItemDraft] = useState<ItemDefinition | null>(null);
  const [textureKind, setTextureKind] = useState<TextureKind>('item');
  const [technicalTab, setTechnicalTab] = useState<TechnicalTab>('behavior');
  const [toast, setToast] = useState('');

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const blockErrors = useMemo(
    () => (selectedProject && blockDraft ? validateBlock(blockDraft, selectedProject) : []),
    [selectedProject, blockDraft],
  );
  const itemErrors = useMemo(
    () => (selectedProject && itemDraft ? validateItem(itemDraft, selectedProject) : []),
    [selectedProject, itemDraft],
  );

  function saveProjects(nextProjects: Project[]) {
    try {
      localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(nextProjects));
      setProjects(nextProjects);
      return true;
    } catch {
      setToast('Browser storage is full. Remove some uploaded textures and try again.');
      return false;
    }
  }

  function updateSelectedProject(updater: (project: Project) => Project) {
    if (!selectedProject) return;
    const nextProjects = projects.map((project) =>
      project.id === selectedProject.id
        ? { ...updater(project), updatedAt: new Date().toISOString() }
        : project,
    );
    saveProjects(nextProjects);
  }

  function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    const namespace = normalizeNamespace(String(data.get('namespace') ?? name));
    const packs: Project['packs'] = [];
    if (data.get('resourcePack')) packs.push('resource');
    if (data.get('behaviorPack')) packs.push('behavior');
    if (!name || !namespace || packs.length === 0) return;

    const now = new Date().toISOString();
    const project: Project = {
      id: createId(),
      name,
      namespace,
      description: `${name} created with Bedrock Studio`,
      version: [0, 2, 0],
      minEngineVersion: CURRENT_BEDROCK_VERSION,
      packs,
      packIds: makePackIds(),
      blocks: [],
      items: [],
      textures: [],
      createdAt: now,
      updatedAt: now,
    };

    if (!saveProjects([project, ...projects])) return;
    setSelectedProjectId(project.id);
    setShowCreate(false);
    setView('dashboard');
    event.currentTarget.reset();
  }

  function selectProject(id: string) {
    setSelectedProjectId(id);
    setBlockDraft(null);
    setItemDraft(null);
    setView('dashboard');
  }

  function startNewBlock() {
    if (!selectedProject) return;
    const firstBlockTexture = selectedProject.textures.find((texture) => texture.kind === 'block')?.key;
    const draft = createBlockDraft(selectedProject.namespace);
    if (firstBlockTexture) draft.texture = firstBlockTexture;
    setBlockDraft(draft);
    setView('block-editor');
  }

  function editBlock(block: BlockDefinition) {
    setBlockDraft({ ...block });
    setView('block-editor');
  }

  function updateBlock<K extends keyof BlockDefinition>(key: K, value: BlockDefinition[K]) {
    setBlockDraft((current) => (current ? { ...current, [key]: value, updatedAt: new Date().toISOString() } : current));
  }

  function saveBlock() {
    if (!selectedProject || !blockDraft || blockErrors.length > 0) return;
    const duplicate = selectedProject.blocks.some(
      (block) => block.id !== blockDraft.id && block.identifier === blockDraft.identifier,
    );
    if (duplicate) return setToast('That block identifier is already in use.');

    updateSelectedProject((project) => {
      const exists = project.blocks.some((block) => block.id === blockDraft.id);
      return {
        ...project,
        blocks: exists
          ? project.blocks.map((block) => (block.id === blockDraft.id ? blockDraft : block))
          : [blockDraft, ...project.blocks],
      };
    });
    setToast('Block saved.');
    setView('blocks');
    setBlockDraft(null);
  }

  function deleteBlock(blockId: string) {
    updateSelectedProject((project) => ({ ...project, blocks: project.blocks.filter((block) => block.id !== blockId) }));
    setToast('Block deleted.');
  }

  function startNewItem() {
    if (!selectedProject) return;
    const firstItemTexture = selectedProject.textures.find((texture) => texture.kind === 'item')?.key ?? '';
    setItemDraft(createItemDraft(selectedProject.namespace, firstItemTexture));
    setView('item-editor');
  }

  function editItem(item: ItemDefinition) {
    setItemDraft({ ...item });
    setView('item-editor');
  }

  function updateItem<K extends keyof ItemDefinition>(key: K, value: ItemDefinition[K]) {
    setItemDraft((current) => (current ? { ...current, [key]: value, updatedAt: new Date().toISOString() } : current));
  }

  function saveItem() {
    if (!selectedProject || !itemDraft || itemErrors.length > 0) return;
    const duplicate = selectedProject.items.some(
      (item) => item.id !== itemDraft.id && item.identifier === itemDraft.identifier,
    );
    if (duplicate) return setToast('That item identifier is already in use.');

    updateSelectedProject((project) => {
      const exists = project.items.some((item) => item.id === itemDraft.id);
      return {
        ...project,
        items: exists
          ? project.items.map((item) => (item.id === itemDraft.id ? itemDraft : item))
          : [itemDraft, ...project.items],
      };
    });
    setToast('Item saved.');
    setView('items');
    setItemDraft(null);
  }

  function deleteItem(itemId: string) {
    updateSelectedProject((project) => ({ ...project, items: project.items.filter((item) => item.id !== itemId) }));
    setToast('Item deleted.');
  }

  async function uploadTexture(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!selectedProject || !file) return;
    if (file.type !== 'image/png') return setToast('Experimental 0.2 accepts PNG textures only.');
    if (file.size > MAX_TEXTURE_BYTES) return setToast('PNG is too large for local experimental storage (max 512 KB).');

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const dimensions = await getImageSize(dataUrl);
      const base = normalizePathName(file.name) || 'texture';
      const key = textureKind === 'item' ? `${selectedProject.namespace}:${base}` : base;
      if (selectedProject.textures.some((texture) => texture.kind === textureKind && texture.key === key)) {
        return setToast(`Texture key ${key} already exists.`);
      }

      const texture: TextureDefinition = {
        id: createId(),
        key,
        kind: textureKind,
        fileName: file.name,
        width: dimensions.width,
        height: dimensions.height,
        size: file.size,
        dataUrl,
        createdAt: new Date().toISOString(),
      };
      updateSelectedProject((project) => ({ ...project, textures: [texture, ...project.textures] }));
      setToast(`${textureKind === 'item' ? 'Item' : 'Block'} texture added.`);
    } catch {
      setToast('Could not read that PNG.');
    }
  }

  function deleteTexture(textureId: string) {
    updateSelectedProject((project) => ({ ...project, textures: project.textures.filter((texture) => texture.id !== textureId) }));
    setToast('Texture removed.');
  }

  async function copyJson(value: unknown) {
    try {
      await navigator.clipboard?.writeText(prettyJson(value));
      setToast('JSON copied.');
    } catch {
      setToast('Clipboard access is unavailable in this browser.');
    }
  }

  const technicalJson = selectedProject
    ? technicalTab === 'behavior'
      ? generateBehaviorManifest(selectedProject)
      : technicalTab === 'resource'
        ? generateResourceManifest(selectedProject)
        : technicalTab === 'item-textures'
          ? generateItemTextureAtlas(selectedProject)
          : generateTerrainTextureAtlas(selectedProject)
    : {};

  const editorMode = view === 'block-editor' || view === 'item-editor';
  const pageTitle = view === 'block-editor'
    ? blockDraft?.name
    : view === 'item-editor'
      ? itemDraft?.name
      : selectedProject?.name ?? 'Your projects';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand brand-button" onClick={() => setView('dashboard')}>
          <div className="brand-mark">B</div>
          <div><strong>Bedrock Studio</strong><span>Experimental 0.2</span></div>
        </button>

        <nav className="nav-section">
          <button className={`nav-item ${view === 'dashboard' ? 'active' : ''}`} onClick={() => setView('dashboard')}>🏠 Project</button>
          <button className={`nav-item ${view === 'blocks' || view === 'block-editor' ? 'active' : ''}`} disabled={!selectedProject} onClick={() => setView('blocks')}>🧱 Blocks <span>{selectedProject?.blocks.length ?? 0}</span></button>
          <button className={`nav-item ${view === 'items' || view === 'item-editor' ? 'active' : ''}`} disabled={!selectedProject} onClick={() => setView('items')}>⚔️ Items <span>{selectedProject?.items.length ?? 0}</span></button>
          <button className={`nav-item ${view === 'textures' ? 'active' : ''}`} disabled={!selectedProject} onClick={() => setView('textures')}>🎨 Textures <span>{selectedProject?.textures.length ?? 0}</span></button>
          <button className={`nav-item ${view === 'technical' ? 'active' : ''}`} disabled={!selectedProject} onClick={() => setView('technical')}>{'{ }'} Files <span>JSON</span></button>
          <button className="nav-item" disabled>🐷 Entities <span>0.4</span></button>
        </nav>

        <div className="sidebar-footer"><span>Target: Bedrock 1.26.40</span><span>Stable features by default.</span></div>
      </aside>

      <main className="workspace">
        {toast && <button className="toast" onClick={() => setToast('')}>{toast} ×</button>}

        <header className="topbar">
          <div><p className="eyebrow">MINECRAFT BEDROCK ADD-ON EDITOR</p><h1>{pageTitle}</h1></div>
          {view === 'block-editor' ? (
            <div className="top-actions"><button className="secondary-button" onClick={() => { setBlockDraft(null); setView('blocks'); }}>Cancel</button><button className="primary-button" disabled={blockErrors.length > 0} onClick={saveBlock}>Save block</button></div>
          ) : view === 'item-editor' ? (
            <div className="top-actions"><button className="secondary-button" onClick={() => { setItemDraft(null); setView('items'); }}>Cancel</button><button className="primary-button" disabled={itemErrors.length > 0} onClick={saveItem}>Save item</button></div>
          ) : (
            <button className="primary-button" onClick={() => setShowCreate(true)}>+ New project</button>
          )}
        </header>

        {showCreate && !editorMode && (
          <section className="create-panel">
            <div className="section-heading"><div><p className="eyebrow">NEW ADD-ON</p><h2>Create a project</h2></div><button className="icon-button" onClick={() => setShowCreate(false)}>×</button></div>
            <form onSubmit={createProject} className="project-form">
              <label>Project name<input name="name" placeholder="Poppy Craft" required /></label>
              <label>Namespace<input name="namespace" placeholder="poppycraft" required /><small>Lowercase letters, numbers and underscores.</small></label>
              <fieldset><legend>Packs</legend>
                <label className="check-card"><input type="checkbox" name="resourcePack" defaultChecked /><span><strong>Resource Pack</strong><small>Textures, models, sounds and visuals.</small></span></label>
                <label className="check-card"><input type="checkbox" name="behaviorPack" defaultChecked /><span><strong>Behavior Pack</strong><small>Blocks, items, entities, recipes and logic.</small></span></label>
              </fieldset>
              <div className="form-actions"><button type="button" className="secondary-button" onClick={() => setShowCreate(false)}>Cancel</button><button type="submit" className="primary-button">Create project</button></div>
            </form>
          </section>
        )}

        {!showCreate && !selectedProject && (
          <section className="empty-state"><div className="cube">🧱</div><h2>Build your first Add-On</h2><p>Bedrock Studio handles pack structure and technical files while you focus on your content.</p><button className="primary-button" onClick={() => setShowCreate(true)}>Create project</button></section>
        )}

        {!showCreate && selectedProject && view === 'dashboard' && (
          <div className="dashboard-grid">
            <section className="card project-card">
              <div className="section-heading"><div><p className="eyebrow">PROJECT OVERVIEW</p><h2>{selectedProject.name}</h2></div><span className="status-pill">Experimental 0.2</span></div>
              <dl className="project-details">
                <div><dt>Namespace</dt><dd>{selectedProject.namespace}</dd></div>
                <div><dt>Minecraft target</dt><dd>{selectedProject.minEngineVersion.join('.')}</dd></div>
                <div><dt>Blocks</dt><dd>{selectedProject.blocks.length}</dd></div>
                <div><dt>Items / textures</dt><dd>{selectedProject.items.length} / {selectedProject.textures.length}</dd></div>
              </dl>
            </section>

            <section className="card quick-actions"><p className="eyebrow">CREATE</p><h2>What do you want to make?</h2><div className="action-grid">
              <button onClick={startNewBlock}><span>🧱</span><strong>Block</strong><small>Visual editor</small></button>
              <button onClick={startNewItem}><span>⚔️</span><strong>Item</strong><small>New in 0.2</small></button>
              <button onClick={() => setView('textures')}><span>🎨</span><strong>Texture</strong><small>PNG library</small></button>
              <button onClick={() => setView('technical')}><span>{'{ }'}</span><strong>Technical files</strong><small>Manifests + atlases</small></button>
            </div></section>

            <section className="card project-list-card"><div className="section-heading"><div><p className="eyebrow">LOCAL PROJECTS</p><h2>Project library</h2></div><span>{projects.length}</span></div><div className="project-list">
              {projects.map((project) => <button key={project.id} className={project.id === selectedProjectId ? 'project-row selected' : 'project-row'} onClick={() => selectProject(project.id)}><span className="project-icon">📦</span><span><strong>{project.name}</strong><small>{project.namespace} · {project.blocks.length} blocks · {project.items.length} items</small></span><span className="chevron">›</span></button>)}
            </div></section>
          </div>
        )}

        {!showCreate && selectedProject && view === 'blocks' && (
          <section className="card content-page">
            <div className="section-heading"><div><p className="eyebrow">CONTENT</p><h2>Blocks</h2><p className="muted">Create Bedrock block definitions visually and inspect generated JSON.</p></div><button className="primary-button" onClick={startNewBlock}>+ New block</button></div>
            {selectedProject.blocks.length === 0 ? <div className="mini-empty"><span>🧱</span><strong>No blocks yet</strong><p>Create a block without writing JSON by hand.</p><button className="primary-button" onClick={startNewBlock}>Create a block</button></div> : <div className="content-list">
              {selectedProject.blocks.map((block) => <div className="content-row" key={block.id}><div className="content-icon">🧱</div><div><strong>{block.name}</strong><small>{block.identifier}</small></div><div className="row-actions"><button className="secondary-button" onClick={() => editBlock(block)}>Edit</button><button className="danger-button" onClick={() => deleteBlock(block.id)}>Delete</button></div></div>)}
            </div>}
          </section>
        )}

        {!showCreate && selectedProject && view === 'items' && (
          <section className="card content-page">
            <div className="section-heading"><div><p className="eyebrow">CONTENT</p><h2>Items</h2><p className="muted">Build stable custom items with visual component controls.</p></div><button className="primary-button" onClick={startNewItem}>+ New item</button></div>
            {selectedProject.items.length === 0 ? <div className="mini-empty"><span>⚔️</span><strong>No items yet</strong><p>Upload an item texture, then create your first item.</p><button className="primary-button" onClick={() => setView('textures')}>Add texture</button></div> : <div className="content-list">
              {selectedProject.items.map((item) => <div className="content-row" key={item.id}><div className="content-icon">⚔️</div><div><strong>{item.name}</strong><small>{item.identifier} · stack {item.maxStackSize}</small></div><div className="row-actions"><button className="secondary-button" onClick={() => editItem(item)}>Edit</button><button className="danger-button" onClick={() => deleteItem(item.id)}>Delete</button></div></div>)}
            </div>}
          </section>
        )}

        {!showCreate && selectedProject && view === 'textures' && (
          <section className="card content-page">
            <div className="section-heading texture-heading"><div><p className="eyebrow">RESOURCE PACK</p><h2>Texture library</h2><p className="muted">Experimental 0.2 stores small PNG textures locally in this browser and generates the correct atlas entries.</p></div><div className="upload-controls"><select value={textureKind} onChange={(event) => setTextureKind(event.target.value as TextureKind)}><option value="item">Item texture</option><option value="block">Block texture</option></select><label className="primary-button file-button">+ Add PNG<input type="file" accept="image/png" onChange={uploadTexture} /></label></div></div>
            {selectedProject.textures.length === 0 ? <div className="mini-empty"><span>🎨</span><strong>No textures yet</strong><p>Upload a small PNG such as 16×16, 32×32, 64×64 or 128×128.</p></div> : <div className="texture-grid">
              {selectedProject.textures.map((texture) => <article className="texture-card" key={texture.id}><div className="texture-preview"><img src={texture.dataUrl} alt={texture.key} /></div><div className="texture-info"><div className="texture-tags"><span>{texture.kind}</span><span>{texture.width}×{texture.height}</span></div><strong>{texture.key}</strong><small>{texture.fileName} · {Math.max(1, Math.round(texture.size / 1024))} KB</small><button className="danger-button" onClick={() => deleteTexture(texture.id)}>Remove</button></div></article>)}
            </div>}
          </section>
        )}

        {!showCreate && selectedProject && view === 'block-editor' && blockDraft && (
          <div className="editor-grid">
            <div className="editor-column">
              <section className="card form-card"><p className="eyebrow">IDENTITY</p><h2>Block basics</h2><div className="field-grid">
                <label>Display name<input value={blockDraft.name} onChange={(e) => updateBlock('name', e.target.value)} /></label>
                <label>Identifier<input value={blockDraft.identifier} onChange={(e) => updateBlock('identifier', e.target.value.toLowerCase())} /></label>
                <label>Texture key<select value={blockDraft.texture} onChange={(e) => updateBlock('texture', e.target.value)}><option value={blockDraft.texture}>{blockDraft.texture || 'Choose texture'}</option>{selectedProject.textures.filter((texture) => texture.kind === 'block' && texture.key !== blockDraft.texture).map((texture) => <option key={texture.id} value={texture.key}>{texture.key}</option>)}</select></label>
                <label>Geometry (optional)<input value={blockDraft.geometry} onChange={(e) => updateBlock('geometry', e.target.value)} placeholder="geometry.factory_box" /></label>
              </div></section>
              <section className="card form-card"><p className="eyebrow">BEHAVIOR</p><h2>Physical properties</h2><div className="field-grid two-col">
                <label>Mining time<input type="number" min="0" step="0.1" value={blockDraft.secondsToDestroy} onChange={(e) => updateBlock('secondsToDestroy', Number(e.target.value))} /></label>
                <label>Explosion resistance<input type="number" min="0" step="0.1" value={blockDraft.explosionResistance} onChange={(e) => updateBlock('explosionResistance', Number(e.target.value))} /></label>
                <label>Friction<input type="number" min="0" max="0.9" step="0.05" value={blockDraft.friction} onChange={(e) => updateBlock('friction', Number(e.target.value))} /></label>
                <label>Light<input type="number" min="0" max="15" step="1" value={blockDraft.lightEmission} onChange={(e) => updateBlock('lightEmission', Number(e.target.value))} /></label>
                <label>Map color<input type="color" value={blockDraft.mapColor} onChange={(e) => updateBlock('mapColor', e.target.value)} /></label>
              </div><div className="toggle-grid"><label className="switch-row"><input type="checkbox" checked={blockDraft.collision} onChange={(e) => updateBlock('collision', e.target.checked)} /><span><strong>Collision</strong><small>Entities collide with the block.</small></span></label><label className="switch-row"><input type="checkbox" checked={blockDraft.selection} onChange={(e) => updateBlock('selection', e.target.checked)} /><span><strong>Selection box</strong><small>The block can be targeted.</small></span></label></div></section>
            </div>
            <div className="editor-column sticky-column"><section className={`card validation-card ${blockErrors.length ? 'has-errors' : 'valid'}`}><p className="eyebrow">VALIDATION</p><h2>{blockErrors.length ? `${blockErrors.length} issue${blockErrors.length === 1 ? '' : 's'} found` : 'Block looks valid'}</h2>{blockErrors.length ? <ul>{blockErrors.map((error) => <li key={error}>{error}</li>)}</ul> : <p className="muted">Ready for Bedrock 1.26.40.</p>}</section><section className="card json-card"><div className="section-heading"><div><p className="eyebrow">GENERATED FILE</p><h2>Block JSON</h2></div><button className="secondary-button" onClick={() => copyJson(generateBlockJson(blockDraft))}>Copy</button></div><pre>{prettyJson(generateBlockJson(blockDraft))}</pre></section></div>
          </div>
        )}

        {!showCreate && selectedProject && view === 'item-editor' && itemDraft && (
          <div className="editor-grid">
            <div className="editor-column">
              <section className="card form-card"><p className="eyebrow">IDENTITY</p><h2>Item basics</h2><div className="field-grid">
                <label>Display name<input value={itemDraft.name} onChange={(e) => updateItem('name', e.target.value)} /></label>
                <label>Identifier<input value={itemDraft.identifier} onChange={(e) => updateItem('identifier', e.target.value.toLowerCase())} /></label>
                <label>Item texture<select value={itemDraft.texture} onChange={(e) => updateItem('texture', e.target.value)}><option value="">Choose texture</option>{selectedProject.textures.filter((texture) => texture.kind === 'item').map((texture) => <option key={texture.id} value={texture.key}>{texture.key}</option>)}</select></label>
                <label>Creative category<select value={itemDraft.category} onChange={(e) => updateItem('category', e.target.value as ItemDefinition['category'])}><option value="items">Items</option><option value="equipment">Equipment</option><option value="construction">Construction</option><option value="nature">Nature</option><option value="none">None</option></select></label>
                <label>Max stack size<input type="number" min="1" max="64" step="1" value={itemDraft.maxStackSize} onChange={(e) => updateItem('maxStackSize', Number(e.target.value))} /></label>
              </div></section>
              <section className="card form-card"><p className="eyebrow">COMPONENTS</p><h2>Built-in item components</h2><p className="muted">Toggle stable Minecraft components. The JSON preview updates instantly.</p><div className="component-grid">
                <label className="switch-row"><input type="checkbox" checked={itemDraft.glint} onChange={(e) => updateItem('glint', e.target.checked)} /><span><strong>✨ Enchanted glint</strong><small>minecraft:glint</small></span></label>
                <label className="switch-row"><input type="checkbox" checked={itemDraft.handEquipped} onChange={(e) => updateItem('handEquipped', e.target.checked)} /><span><strong>🛠 Hand equipped</strong><small>minecraft:hand_equipped</small></span></label>
                <label className="switch-row"><input type="checkbox" checked={itemDraft.fireResistant} onChange={(e) => updateItem('fireResistant', e.target.checked)} /><span><strong>🔥 Fire resistant</strong><small>minecraft:fire_resistant</small></span></label>
              </div></section>
            </div>
            <div className="editor-column sticky-column"><section className={`card validation-card ${itemErrors.length ? 'has-errors' : 'valid'}`}><p className="eyebrow">VALIDATION</p><h2>{itemErrors.length ? `${itemErrors.length} issue${itemErrors.length === 1 ? '' : 's'} found` : 'Item looks valid'}</h2>{itemErrors.length ? <ul>{itemErrors.map((error) => <li key={error}>{error}</li>)}</ul> : <p className="muted">Includes required components for modern item parsing.</p>}</section><section className="card json-card"><div className="section-heading"><div><p className="eyebrow">GENERATED FILE</p><h2>Item JSON</h2></div><button className="secondary-button" onClick={() => copyJson(generateItemJson(itemDraft))}>Copy</button></div><pre>{prettyJson(generateItemJson(itemDraft))}</pre></section></div>
          </div>
        )}

        {!showCreate && selectedProject && view === 'technical' && (
          <section className="card content-page">
            <div className="section-heading"><div><p className="eyebrow">TECHNICAL FILES</p><h2>Generated project files</h2><p className="muted">Inspect manifests and texture atlases generated from your project.</p></div></div>
            <div className="tab-bar"><button className={technicalTab === 'behavior' ? 'active' : ''} disabled={!selectedProject.packs.includes('behavior')} onClick={() => setTechnicalTab('behavior')}>BP manifest</button><button className={technicalTab === 'resource' ? 'active' : ''} disabled={!selectedProject.packs.includes('resource')} onClick={() => setTechnicalTab('resource')}>RP manifest</button><button className={technicalTab === 'item-textures' ? 'active' : ''} onClick={() => setTechnicalTab('item-textures')}>item_texture.json</button><button className={technicalTab === 'terrain-textures' ? 'active' : ''} onClick={() => setTechnicalTab('terrain-textures')}>terrain_texture.json</button></div>
            <div className="json-panel"><button className="secondary-button copy-json" onClick={() => copyJson(technicalJson)}>Copy JSON</button><pre>{prettyJson(technicalJson)}</pre></div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
