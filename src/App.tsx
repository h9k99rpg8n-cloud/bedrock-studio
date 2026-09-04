import { FormEvent, useMemo, useState } from 'react';
import {
  BlockDefinition,
  CURRENT_BEDROCK_VERSION,
  Project,
  createBlockDraft,
  generateBehaviorManifest,
  generateBlockJson,
  generateResourceManifest,
  makePackIds,
  migrateProject,
  normalizeNamespace,
  prettyJson,
  validateBlock,
} from './bedrock';

type View = 'dashboard' | 'blocks' | 'block-editor' | 'technical';
type TechnicalTab = 'behavior' | 'resource';

const PROJECT_STORAGE_KEY = 'bedrock-studio.projects';

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

function App() {
  const initialProjects = useMemo(loadProjects, []);
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialProjects[0]?.id ?? null);
  const [view, setView] = useState<View>('dashboard');
  const [showCreate, setShowCreate] = useState(false);
  const [blockDraft, setBlockDraft] = useState<BlockDefinition | null>(null);
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

  function saveProjects(nextProjects: Project[]) {
    setProjects(nextProjects);
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(nextProjects));
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
      id: crypto.randomUUID(),
      name,
      namespace,
      description: `${name} created with Bedrock Studio`,
      version: [0, 1, 0],
      minEngineVersion: CURRENT_BEDROCK_VERSION,
      packs,
      packIds: makePackIds(),
      blocks: [],
      createdAt: now,
      updatedAt: now,
    };

    saveProjects([project, ...projects]);
    setSelectedProjectId(project.id);
    setShowCreate(false);
    setView('dashboard');
    event.currentTarget.reset();
  }

  function selectProject(id: string) {
    setSelectedProjectId(id);
    setBlockDraft(null);
    setView('dashboard');
  }

  function startNewBlock() {
    if (!selectedProject) return;
    setBlockDraft(createBlockDraft(selectedProject.namespace));
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
    if (duplicate) {
      setToast('That identifier is already used by another block.');
      return;
    }

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
    updateSelectedProject((project) => ({
      ...project,
      blocks: project.blocks.filter((block) => block.id !== blockId),
    }));
    setToast('Block deleted.');
  }

  async function copyJson(value: unknown) {
    await navigator.clipboard?.writeText(prettyJson(value));
    setToast('JSON copied.');
  }

  const technicalJson = selectedProject
    ? technicalTab === 'behavior'
      ? generateBehaviorManifest(selectedProject)
      : generateResourceManifest(selectedProject)
    : {};

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand brand-button" onClick={() => setView('dashboard')}>
          <div className="brand-mark">B</div>
          <div><strong>Bedrock Studio</strong><span>Experimental 0.1</span></div>
        </button>

        <nav className="nav-section">
          <button className={`nav-item ${view === 'dashboard' ? 'active' : ''}`} onClick={() => setView('dashboard')}>🏠 Project</button>
          <button className={`nav-item ${view === 'blocks' || view === 'block-editor' ? 'active' : ''}`} disabled={!selectedProject} onClick={() => setView('blocks')}>🧱 Blocks <span>{selectedProject?.blocks.length ?? 0}</span></button>
          <button className={`nav-item ${view === 'technical' ? 'active' : ''}`} disabled={!selectedProject} onClick={() => setView('technical')}>{'{ }'} Files <span>JSON</span></button>
          <button className="nav-item" disabled>⚔️ Items <span>0.2</span></button>
          <button className="nav-item" disabled>🐷 Entities <span>0.4</span></button>
          <button className="nav-item" disabled>🎨 Textures <span>0.2</span></button>
        </nav>

        <div className="sidebar-footer"><span>Target: Bedrock 1.26.40</span><span>Stable features by default.</span></div>
      </aside>

      <main className="workspace">
        {toast && <button className="toast" onClick={() => setToast('')}>{toast} ×</button>}

        <header className="topbar">
          <div>
            <p className="eyebrow">MINECRAFT BEDROCK ADD-ON EDITOR</p>
            <h1>{view === 'block-editor' ? blockDraft?.name : selectedProject?.name ?? 'Your projects'}</h1>
          </div>
          {view === 'block-editor' ? (
            <div className="top-actions">
              <button className="secondary-button" onClick={() => { setBlockDraft(null); setView('blocks'); }}>Cancel</button>
              <button className="primary-button" disabled={blockErrors.length > 0} onClick={saveBlock}>Save block</button>
            </div>
          ) : (
            <button className="primary-button" onClick={() => setShowCreate(true)}>+ New project</button>
          )}
        </header>

        {showCreate && (
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
              <div className="section-heading"><div><p className="eyebrow">PROJECT OVERVIEW</p><h2>{selectedProject.name}</h2></div><span className="status-pill">Experimental</span></div>
              <dl className="project-details">
                <div><dt>Namespace</dt><dd>{selectedProject.namespace}</dd></div>
                <div><dt>Version</dt><dd>{selectedProject.version.join('.')}</dd></div>
                <div><dt>Minecraft target</dt><dd>{selectedProject.minEngineVersion.join('.')}</dd></div>
                <div><dt>Blocks</dt><dd>{selectedProject.blocks.length}</dd></div>
              </dl>
            </section>

            <section className="card quick-actions"><p className="eyebrow">CREATE</p><h2>What do you want to make?</h2><div className="action-grid">
              <button onClick={startNewBlock}><span>🧱</span><strong>Block</strong><small>Visual editor ready</small></button>
              <button disabled><span>⚔️</span><strong>Item</strong><small>Experimental 0.2</small></button>
              <button disabled><span>🐷</span><strong>Entity</strong><small>Experimental 0.4</small></button>
              <button onClick={() => setView('technical')}><span>{'{ }'}</span><strong>Technical files</strong><small>Inspect manifests</small></button>
            </div></section>

            <section className="card project-list-card"><div className="section-heading"><div><p className="eyebrow">LOCAL PROJECTS</p><h2>Project library</h2></div><span>{projects.length}</span></div><div className="project-list">
              {projects.map((project) => <button key={project.id} className={project.id === selectedProjectId ? 'project-row selected' : 'project-row'} onClick={() => selectProject(project.id)}><span className="project-icon">📦</span><span><strong>{project.name}</strong><small>{project.namespace} · {project.blocks.length} blocks</small></span><span className="chevron">›</span></button>)}
            </div></section>
          </div>
        )}

        {!showCreate && selectedProject && view === 'blocks' && (
          <section className="card content-page">
            <div className="section-heading"><div><p className="eyebrow">CONTENT</p><h2>Blocks</h2><p className="muted">Create Bedrock block definitions visually and inspect the generated JSON.</p></div><button className="primary-button" onClick={startNewBlock}>+ New block</button></div>
            {selectedProject.blocks.length === 0 ? <div className="mini-empty"><span>🧱</span><strong>No blocks yet</strong><p>Your first block can be created without writing JSON by hand.</p><button className="primary-button" onClick={startNewBlock}>Create a block</button></div> : <div className="content-list">
              {selectedProject.blocks.map((block) => <div className="content-row" key={block.id}><div className="content-icon">🧱</div><div><strong>{block.name}</strong><small>{block.identifier}</small></div><div className="row-actions"><button className="secondary-button" onClick={() => editBlock(block)}>Edit</button><button className="danger-button" onClick={() => deleteBlock(block.id)}>Delete</button></div></div>)}
            </div>}
          </section>
        )}

        {!showCreate && selectedProject && view === 'block-editor' && blockDraft && (
          <div className="editor-grid">
            <div className="editor-column">
              <section className="card form-card"><p className="eyebrow">IDENTITY</p><h2>Block basics</h2><div className="field-grid">
                <label>Display name<input value={blockDraft.name} onChange={(e) => updateBlock('name', e.target.value)} /></label>
                <label>Identifier<input value={blockDraft.identifier} onChange={(e) => updateBlock('identifier', e.target.value.toLowerCase())} /></label>
                <label>Texture key<input value={blockDraft.texture} onChange={(e) => updateBlock('texture', e.target.value.toLowerCase())} placeholder="factory_box" /></label>
                <label>Geometry (optional)<input value={blockDraft.geometry} onChange={(e) => updateBlock('geometry', e.target.value)} placeholder="geometry.factory_box" /></label>
              </div></section>

              <section className="card form-card"><p className="eyebrow">BEHAVIOR</p><h2>Physical properties</h2><div className="field-grid two-col">
                <label>Mining time (seconds)<input type="number" min="0" step="0.1" value={blockDraft.secondsToDestroy} onChange={(e) => updateBlock('secondsToDestroy', Number(e.target.value))} /></label>
                <label>Explosion resistance<input type="number" min="0" step="0.1" value={blockDraft.explosionResistance} onChange={(e) => updateBlock('explosionResistance', Number(e.target.value))} /></label>
                <label>Friction (0–0.9)<input type="number" min="0" max="0.9" step="0.05" value={blockDraft.friction} onChange={(e) => updateBlock('friction', Number(e.target.value))} /></label>
                <label>Light (0–15)<input type="number" min="0" max="15" step="1" value={blockDraft.lightEmission} onChange={(e) => updateBlock('lightEmission', Number(e.target.value))} /></label>
                <label>Map color<input type="color" value={blockDraft.mapColor} onChange={(e) => updateBlock('mapColor', e.target.value)} /></label>
              </div>
              <div className="toggle-grid"><label className="switch-row"><input type="checkbox" checked={blockDraft.collision} onChange={(e) => updateBlock('collision', e.target.checked)} /><span><strong>Collision</strong><small>Players and entities collide with this block.</small></span></label><label className="switch-row"><input type="checkbox" checked={blockDraft.selection} onChange={(e) => updateBlock('selection', e.target.checked)} /><span><strong>Selection box</strong><small>The block can be targeted normally.</small></span></label></div>
              </section>
            </div>

            <div className="editor-column sticky-column">
              <section className={`card validation-card ${blockErrors.length ? 'has-errors' : 'valid'}`}><p className="eyebrow">VALIDATION</p><h2>{blockErrors.length ? `${blockErrors.length} issue${blockErrors.length === 1 ? '' : 's'} found` : 'Block looks valid'}</h2>{blockErrors.length > 0 ? <ul>{blockErrors.map((error) => <li key={error}>{error}</li>)}</ul> : <p className="muted">Ready to save using the current stable Bedrock target.</p>}</section>
              <section className="card json-card"><div className="section-heading"><div><p className="eyebrow">GENERATED FILE</p><h2>Behavior JSON</h2></div><button className="secondary-button" onClick={() => copyJson(generateBlockJson(blockDraft))}>Copy</button></div><pre>{prettyJson(generateBlockJson(blockDraft))}</pre></section>
            </div>
          </div>
        )}

        {!showCreate && selectedProject && view === 'technical' && (
          <section className="card content-page">
            <div className="section-heading"><div><p className="eyebrow">TECHNICAL FILES</p><h2>Generated manifests</h2><p className="muted">Bedrock Studio preserves UUIDs for the life of the project instead of regenerating them on every export.</p></div></div>
            <div className="tab-bar"><button className={technicalTab === 'behavior' ? 'active' : ''} disabled={!selectedProject.packs.includes('behavior')} onClick={() => setTechnicalTab('behavior')}>Behavior Pack</button><button className={technicalTab === 'resource' ? 'active' : ''} disabled={!selectedProject.packs.includes('resource')} onClick={() => setTechnicalTab('resource')}>Resource Pack</button></div>
            <div className="json-panel"><button className="secondary-button copy-json" onClick={() => copyJson(technicalJson)}>Copy JSON</button><pre>{prettyJson(technicalJson)}</pre></div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
