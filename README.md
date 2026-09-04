# Bedrock Studio

A modern web-based editor for creating Minecraft Bedrock Add-Ons without needing to write everything by hand.

Bedrock Studio is designed to make Add-On creation approachable for beginners while keeping advanced tools available for experienced creators. The editor will generate and manage pack structure, manifests, identifiers, components, textures, models, validation, JSON and export workflows.

## Current status

🚧 **Experimental 0.1 development**

The first working shell is already in the repository. It includes:

- Responsive web interface for desktop, tablet and mobile.
- Local project library.
- New-project creation flow.
- Namespace handling.
- Resource Pack / Behavior Pack selection.
- Project metadata and version display.
- Foundation for the upcoming block editor.

Projects currently persist in the browser using local storage while the project format is being designed.

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

| Version | Focus |
| --- | --- |
| **Experimental 0.1** | Project system, manifests and block creation |
| **Experimental 0.2** | Items, textures and component editor |
| **Experimental 0.3** | Geometry import and improved JSON tools |
| **Experimental 0.4** | Entity editor |
| **Experimental 0.5** | Recipes, loot tables, spawn rules and stronger validation |
| **Experimental 0.6** | Packaging/export, polish and release preparation |
| **1.0** | First stable release |

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
