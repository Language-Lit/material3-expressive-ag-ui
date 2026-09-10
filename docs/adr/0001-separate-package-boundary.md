# ADR 0001: A separate package, not a new entry point

Status: accepted
Date: 2026-09-10

## Context

AG-UI support was requested for `@language-lit/material3-expressive`. The
obvious shape — a `./ag-ui` subpath on the existing package — is not available.

That package's specification is normative on two points. §1.2 fixes its public
export map at exactly `.`, `./theme`, `./tokens`, and `./styles.css`, and makes
adding a path a breaking change requiring owner approval and an ADR. §1.3
requires CI to continuously verify "the absence of runtime dependencies and of
any peer beyond React and React DOM."

`@ag-ui/client` depends on rxjs, zod, and uuid. Any AG-UI code inside `src/`
would either introduce a third peer dependency or vendor those libraries, and
either way the design system's own CI would fail. The constraint is structural,
not stylistic: the design system's value proposition is that it is a leaf
dependency, and agent protocol support is not leaf-shaped.

A monorepo was also considered and rejected for this slice: the design system
repository is a single-package repository with release, versioning, and
verification scripts written against that assumption, and restructuring it is a
far larger change than the feature warrants.

## Decision

AG-UI support ships as `@language-lit/material3-expressive-ag-ui`, a sibling
repository and an independently versioned package.

It depends on `@language-lit/material3-expressive` as a **peer**, at the same
arm's length as any application: public entry points only, no `.m3e-*`
selectors, no `node_modules` patching, tokens for every design value. It ships
zero runtime dependencies of its own and takes `@ag-ui/client` and `@ag-ui/core`
as peers, so the consumer owns one copy of the protocol SDK.

Its own CSS is namespaced under `.m3e-agui` and the namespace is enforced by the
build, so the two stylesheets cannot collide however they are ordered.

## Consequences

- The design system keeps its leaf-dependency guarantee and its four-path export
  map unchanged. No ADR against that repository is required.
- Two version ranges must be kept compatible. The peer range
  (`^1.2.0`) states the contract; a breaking change there is a major here.
- Consumers install and configure two packages. This is stated in the README
  rather than hidden behind a re-export, because re-exporting the design
  system's surface would create a second, drifting copy of its API.
- Some duplication is accepted — a small `cx` helper and hand-authored SVG
  glyphs — rather than reaching into library internals for them.
- If a future consumer wants both from one install, that is a meta-package
  decision, not a reason to merge the trees.
