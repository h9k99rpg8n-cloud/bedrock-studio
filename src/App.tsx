import { FormEvent, useMemo, useState } from 'react';

type PackMode = 'resource' | 'behavior';

type Project = {
  id: string;
  name: string;
  namespace: string;
  version: [number, number, number];
  packs: PackMode[];
  createdAt: string;
};

const PROJECT_STORAGE_KEY = 'bedrock-studio.projects';

function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(PROJECT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Project[]) : [];
  } catch {
    return [];
  }
}

function normalizeNamespace(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function App() {
  const [projects, setProjects] = useState<Project[]>(loadProjects);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    () => loadProjects()[0]?.id ?? null,
  );
  const [showCreate, setShowCreate] = useState(false);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  function saveProjects(nextProjects: Project[]) {
    setProjects(nextProjects);
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(nextProjects));
  }

  function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    const namespace = normalizeNamespace(String(data.get('namespace') ?? name));
    const packs: PackMode[] = [];

    if (data.get('resourcePack')) packs.push('resource');
    if (data.get('behaviorPack')) packs.push('behavior');

    if (!name || !namespace || packs.length === 0) return;

    const project: Project = {
      id: crypto.randomUUID(),
      name,
      namespace,
      version: [0, 1, 0],
      packs,
      createdAt: new Date().toISOString(),
    };

    const nextProjects = [project, ...projects];
    saveProjects(nextProjects);
    setSelectedProjectId(project.id);
    setShowCreate(false);
    event.currentTarget.reset();
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">B</div>
          <div>
            <strong>Bedrock Studio</strong>
            <span>Experimental 0.1</span>
          </div>
        </div>

        <nav className="nav-section">
          <button className="nav-item active">🏠 Projects</button>
          <button className="nav-item" disabled>🧱 Blocks <span>Soon</span></button>
          <button className="nav-item" disabled>⚔️ Items <span>0.2</span></button>
          <button className="nav-item" disabled>🐷 Entities <span>0.4</span></button>
          <button className="nav-item" disabled>🎨 Textures <span>0.2</span></button>
          <button className="nav-item" disabled>🦴 Geometry <span>0.3</span></button>
        </nav>

        <div className="sidebar-footer">
          <span>Simple outside.</span>
          <span>Powerful underneath.</span>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">MINECRAFT BEDROCK ADD-ON EDITOR</p>
            <h1>{selectedProject ? selectedProject.name : 'Your projects'}</h1>
          </div>
          <button className="primary-button" onClick={() => setShowCreate(true)}>
            + New project
          </button>
        </header>

        {showCreate && (
          <section className="create-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">NEW ADD-ON</p>
                <h2>Create a project</h2>
              </div>
              <button className="icon-button" onClick={() => setShowCreate(false)} aria-label="Close">
                ×
              </button>
            </div>

            <form onSubmit={createProject} className="project-form">
              <label>
                Project name
                <input name="name" placeholder="Poppy Craft" required />
              </label>
              <label>
                Namespace
                <input name="namespace" placeholder="poppycraft" required />
                <small>Lowercase letters, numbers and underscores.</small>
              </label>

              <fieldset>
                <legend>Packs</legend>
                <label className="check-card">
                  <input type="checkbox" name="resourcePack" defaultChecked />
                  <span><strong>Resource Pack</strong><small>Textures, models, sounds and visuals.</small></span>
                </label>
                <label className="check-card">
                  <input type="checkbox" name="behaviorPack" defaultChecked />
                  <span><strong>Behavior Pack</strong><small>Blocks, items, entities, recipes and logic.</small></span>
                </label>
              </fieldset>

              <div className="form-actions">
                <button type="button" className="secondary-button" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="primary-button">Create project</button>
              </div>
            </form>
          </section>
        )}

        {!showCreate && !selectedProject && (
          <section className="empty-state">
            <div className="cube">🧱</div>
            <h2>Build your first Add-On</h2>
            <p>Bedrock Studio will handle project structure and technical files while you focus on what you want to create.</p>
            <button className="primary-button" onClick={() => setShowCreate(true)}>Create project</button>
          </section>
        )}

        {!showCreate && selectedProject && (
          <div className="dashboard-grid">
            <section className="card project-card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">PROJECT OVERVIEW</p>
                  <h2>{selectedProject.name}</h2>
                </div>
                <span className="status-pill">Experimental</span>
              </div>

              <dl className="project-details">
                <div><dt>Namespace</dt><dd>{selectedProject.namespace}</dd></div>
                <div><dt>Version</dt><dd>{selectedProject.version.join('.')}</dd></div>
                <div><dt>Resource Pack</dt><dd>{selectedProject.packs.includes('resource') ? 'Enabled' : 'Disabled'}</dd></div>
                <div><dt>Behavior Pack</dt><dd>{selectedProject.packs.includes('behavior') ? 'Enabled' : 'Disabled'}</dd></div>
              </dl>
            </section>

            <section className="card quick-actions">
              <p className="eyebrow">CREATE</p>
              <h2>What do you want to make?</h2>
              <div className="action-grid">
                <button><span>🧱</span><strong>Block</strong><small>Coming in 0.1</small></button>
                <button disabled><span>⚔️</span><strong>Item</strong><small>Experimental 0.2</small></button>
                <button disabled><span>🐷</span><strong>Entity</strong><small>Experimental 0.4</small></button>
                <button disabled><span>🎨</span><strong>Texture</strong><small>Experimental 0.2</small></button>
              </div>
            </section>

            <section className="card project-list-card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">LOCAL PROJECTS</p>
                  <h2>Project library</h2>
                </div>
                <span>{projects.length}</span>
              </div>

              <div className="project-list">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    className={project.id === selectedProjectId ? 'project-row selected' : 'project-row'}
                    onClick={() => setSelectedProjectId(project.id)}
                  >
                    <span className="project-icon">📦</span>
                    <span><strong>{project.name}</strong><small>{project.namespace}</small></span>
                    <span className="chevron">›</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
