---
title: Website
section: site
status: foundation
visibility: internal
---

# Website

This folder contains the first static website foundation for the 7CS Constitution.

The Markdown and YAML files in the repository remain the source of truth. The website generator reads those files and writes static HTML into `site/dist`.

## Build

From the repository root:

```sh
npm run build
```

This runs `node site/build.mjs`.

## Preview

From the repository root:

```sh
npm run serve
```

Then open `http://localhost:4177`.

## Deployment

GitHub Actions publishes the site to GitHub Pages when changes are merged into `main`.

The workflow runs:

```sh
npm run build
```

It publishes the generated `site/dist` directory.

## Structure

- `navigation.yml` defines the canonical website navigation.
- `build.mjs` converts Markdown files into static HTML.
- `serve.mjs` serves the generated files locally.
- `assets/styles.css` defines the quiet library visual system.
- `dist/` is generated output and is not committed.
