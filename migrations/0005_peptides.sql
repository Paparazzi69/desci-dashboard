-- Migration 0005: peptides registry + program-link join.
--
-- Status: NOT YET APPLIED. This file is staged for a future /peptides index
-- page (out of scope for the OX2R-004 deep-dive port). Apply with:
--
--     wrangler d1 execute desci-dashboard --remote --file=migrations/0005_peptides.sql
--
-- Once applied, scripts/seed-peptides.* (also out of scope) will backfill
-- OX2R-004 → PeptAI as the seed row, and the static /peptides/<slug>/
-- pages can shift to data-driven render.

CREATE TABLE peptides (
  slug             TEXT PRIMARY KEY,           -- url segment, e.g. 'ox2r-004'
  display_name     TEXT NOT NULL,              -- 'OX2R-004'
  parent_project   TEXT,                       -- FK to a project slug, nullable
                                               -- for industry molecules with no
                                               -- parent agent (BPC-157, etc.)
  receptor_target  TEXT,                       -- 'OX2R', 'GLP-1R', etc.
  candidate_status TEXT,                       -- 'pre-IND', 'in-vivo', 'phase-1'
  created_at       INTEGER NOT NULL,           -- unix seconds
  updated_at       INTEGER NOT NULL            -- unix seconds
);

CREATE TABLE peptide_program_links (
  peptide_slug TEXT NOT NULL,
  project_slug TEXT NOT NULL,
  link_type    TEXT NOT NULL,                  -- 'parent' | 'related' | 'comparable'
  PRIMARY KEY (peptide_slug, project_slug)
);

-- Lookup by parent project for the future /projects/<slug>/peptides view.
CREATE INDEX idx_peptides_parent ON peptides(parent_project);

-- Lookup by project for cross-linking from project pages back to molecules.
CREATE INDEX idx_peptide_links_project ON peptide_program_links(project_slug);
