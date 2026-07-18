# AgentVille Furniture Environment Refresh

**Date:** 2026-07-17
**Status:** Approved

## Goal

Replace the generated placeholder office background with a composed pixel-art environment built from the user-provided `Office-Furniture-Pixel-Art` pack, while preserving live human agent sprites, selection, assignment, and status behavior.

## Composition

Use the pack's tileset for floor/wall texture and its furniture sprites for a readable 960×640 office:

- central product desks with desks, chairs, monitors, filing/storage props;
- upper-right attention room with board/clock/filing furniture;
- lower-left coffee/reset room with coffee machine, water dispenser, vending machine, and small seating;
- lower-center lounge with sofas, round table, plants, and bookshelves.

The background is a precomposed PNG so the existing Phaser scene remains responsible for live agents and interactions. Agent seat coordinates remain stable; furniture must be arranged around those coordinates rather than underneath the characters' heads/bodies.

## Asset handling

Copy the supplied PNG pack into `web/public/assets/office/furniture/` with provenance notes. The composed background should be generated locally from those source PNGs and committed as `office-background-furniture.png` (or replace the current background only after visual verification). Do not modify the source pack.

## Verification

- confirm all source sprites are served locally without network requests;
- verify the composed background is 960×640 RGBA and nearest-neighbor friendly;
- verify all three human agents remain visible at desk/attention coordinates;
- verify empty-desk hit testing and agent selection still work;
- run the full test suite and production build.

