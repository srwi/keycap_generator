# Keycap Generator <img src="public/icon.png" align="right" width="25%"/>

[![Deployment](https://github.com/srwi/keycap_generator/actions/workflows/deploy.yml/badge.svg)](https://github.com/srwi/keycap_generator/actions/workflows/deploy.yml) [![CI](https://github.com/srwi/keycap_generator/actions/workflows/ci.yml/badge.svg)](https://github.com/srwi/keycap_generator/actions/workflows/ci.yml)

[Open in browser](https://srwi.github.io/keycap_generator/)

This online keycap generator creates multi-color keycap models for 3D printing from existing or custom STL keycap base models and legend definitions.

The project separates three concepts so you can reuse shapes and layout rules to produce keycaps for custom keyboard layouts easily:

- **Models:** A base STL that defines the physical keycap geometry and profile. You can select from existing models or upload your own STL files.
- **Templates:** A reusable placement definition that describes legend position, rotation, font, scale, and color mapping for a model.
- **Keys:** A concrete instance that pairs a model with a template and specific legend text or symbol to produce an exportable mesh.

This separation makes it straightforward to assemble keyboard layouts from a small set of models and templates and export multi-color, slicer-ready 3mf-files.

# Development

The project uses [Bun](https://bun.sh/) as the runtime and package manager. To get started with development, run:

```bash
bun install
bun dev
```
