# Bedrock Studio

A modern web-based editor for creating Minecraft Bedrock Add-Ons without needing to write everything by hand.

Bedrock Studio is designed to make Add-On creation approachable for beginners while keeping advanced tools available for experienced creators. The editor manages pack structure, manifests, identifiers, components, textures, validation and generated JSON while keeping the underlying Bedrock data visible.

## Current status

🧪 **Experimental 0.2**

The current web build includes:

- Responsive interface for desktop, tablet and mobile.
- Local project library with automatic migration from Experimental 0.1 projects.
- Resource Pack / Behavior Pack project setup.
- Persistent project UUIDs and generated manifests.
- Visual custom block editor with live validation and JSON preview.
- Visual custom item editor.
- Stable built-in item component toggles for enchanted glint, hand-equipped rendering and fire resistance.
- Item stack-size and Creative category controls.
- PNG texture library for item and block textures.
- Pixel-art texture previews and texture metadata.
- Automatic `item_texture.json` generation.
- Automatic `terrain_texture.json` generation.
- Copyable generated JSON.
- Runtime compatibility fallback and visible startup diagnostics instead of a silent white screen.

Small texture PNGs are stored locally in the browser during this experimental phase. Experimental 0.2 currently limits each uploaded texture to 512 KB to avoid exhausting browser local storage.

## Minecraft target

Bedrock Studio currently targets **Minecraft Bedrock 1.26.40** stable features by default. Experimental/Preview-only functionality will be kept separate instead of silently mixing it into normal projects.

## Project goals

- Easy visual creation of Minecraft Bedrock Add-Ons.
- Resource Pack + Behavior Pack project management.
- Automatic manifests, UUIDs and folder structure.
- Visual editors for blocks, items, entities and other content types.
- Component-based editing with searchable Minecraft components.
- Advanced JSON editing when needed.
- Project validation with useful error messages.
- Import of textures and Bedrock geometry files.
- Export to Bedrock-friendly package formats.
- Web-first interface that works well on desktop, tablet and mobile.

## Experimental roadmap

| Version | Focus | Status |
| --- | --- | --- |
| **Experimental 0.1** | Project system, manifests and block creation | ✅ Complete foundation |
| **Experimental 0.2** | Items, textures and component editor | 🧪 Current |
| **Experimental 0.3** | Geometry import and improved JSON tools | Next |
| **Experimental 0.4** | Entity editor | Planned |
| **Experimental 0.5** | Recipes, loot tables, spawn rules and stronger validation | Planned |
| **Experimental 0.6** | Packaging/export, polish and release preparation | Planned |
| **1.0** | First stable release | Planned |

## Design principle

> **Simple on the outside, powerful underneath.**

A creator should not need to understand every JSON file to make an Add-On, but Bedrock Studio should never lock advanced users out of the underlying data.

## Development

Requirements: a recent Node.js installation.

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## Technology

- React
- TypeScript
- Vite
- Browser local storage during the early experimental project-format phase

## License

MIT.

## Disclaimer

Minecraft is a trademark of Microsoft. Bedrock Studio is an independent community project and is not affiliated with or endorsed by Mojang Studios or Microsoft.
