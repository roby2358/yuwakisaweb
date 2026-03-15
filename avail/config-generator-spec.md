# Install Config Generator — Mini Spec

## Problem

Our install process requires manually authoring multiple complex config files
(package registrations, feature extensions, certificate packages, AWS resource
addresses, etc.) before triggering an install run. This takes ~1 hour per
install, is error-prone, requires tribal knowledge, and produces inconsistent
results across engineers due to no authoritative source of truth for values.

## Goal

A CLI tool that:
1. Asks the engineer the *real* questions (environment, region, client, etc.)
2. Derives the majority of config values deterministically from those answers
3. Validates derived values before generation (fail fast, not at install time)
4. Renders all required config files from templates
5. Stores canonical values in version-controlled files (non-secret values only)

## Design Principles

- **Derive, don't prompt.** If a value follows from another value, compute it.
  Only ask humans for things that are genuinely underdetermined.
- **Validate before generate.** Check AWS ARNs resolve, internal endpoints
  respond, cert packages exist — before writing a single config file.
- **Secrets are not stored here.** Credentials, private keys, and passwords
  are fetched at generation time from a secrets manager (AWS Secrets Manager
  or equivalent). This repo contains no secrets.
- **Config values are the source of truth.** Canonical non-secret values
  (ARN patterns, endpoint URLs, feature flag names, package identifiers,
  environment topology) live in `values/` as versioned YAML. This resolves
  ambiguity about what the "official" value is.

## Repository Structure

```
config-generator/
├── values/                  # Canonical non-secret values (version controlled)
│   ├── environments.yaml    # Per-environment topology and ARN patterns
│   ├── packages.yaml        # Internal package registry identifiers
│   ├── certificates.yaml    # Certificate package names and locations
│   └── features.yaml        # Feature flag names and valid options
├── templates/               # Jinja2 templates for each config file
│   ├── <config-file-1>.j2
│   ├── <config-file-2>.j2
│   └── ...
├── generator/
│   ├── cli.py               # Entry point, prompts, orchestration
│   ├── derive.py            # Derivation logic: inputs → full config context
│   ├── validate.py          # Pre-generation validators
│   ├── render.py            # Template rendering
│   └── secrets.py           # Secrets manager integration
├── output/                  # Generated config files land here (gitignored)
└── README.md
```

## Inputs (What the Human Actually Decides)

The CLI should prompt for only these values. Everything else is derived.

| Input | Type | Notes |
|---|---|---|
| Environment | enum | e.g. dev / staging / prod |
| Region | enum | AWS region |
| Client / Tenant | string | If multi-tenant |
| Install variant | enum | If multiple install profiles exist |

> **Note to implementer:** These are placeholders. Before building the
> derivation layer, the actual real-inputs vs derived-values split needs to be
> confirmed against the real config files. The pattern holds; the specifics
> will differ.

## Derivation Layer (`derive.py`)

Takes the small set of human inputs and produces a full context dict that
templates can consume. Examples of what derivation should handle:

- ARN construction from account ID + region + resource name patterns
- Endpoint URL assembly from environment + service name
- Certificate package selection from environment tier
- Feature flag defaults from install variant
- Internal registry package IDs from environment

This is the core intellectual value of the tool. It encodes what engineers
currently carry in their heads.

## Validation Layer (`validate.py`)

Run before any files are written. Should include:

- **ARN validation:** Confirm ARNs are syntactically valid; optionally use
  boto3 to confirm resources exist and are accessible
- **Endpoint reachability:** HTTP HEAD/GET against internal service URLs
- **Certificate package existence:** Confirm named cert bundles are present
  in expected locations
- **Package registry resolution:** Confirm internal package identifiers resolve
- **Cross-field consistency:** e.g. region-specific resources match declared region

Validation failures should be clear, actionable error messages — not stack
traces. The engineer should know exactly what is wrong and where to look.

## Template Layer (`templates/`)

- Jinja2 templates, one per generated config file
- Templates receive the full derived context dict
- Templates should have no logic beyond basic conditionals and loops —
  all logic lives in `derive.py`
- Output file names and paths should be configurable

## Secrets Integration (`secrets.py`)

- Fetch secrets at generation time, never store them
- Target: AWS Secrets Manager (boto3)
- Secrets should be fetched by logical name, resolved to ARN via
  `values/environments.yaml`
- If a secret fetch fails, abort with a clear error before any files are written

## CLI UX

```
$ python -m generator

Environment [dev/staging/prod]: prod
Region [us-east-1/us-west-2/...]: us-east-1
Client: acme

Deriving values...
Validating...
  ✓ ARNs valid
  ✓ Endpoints reachable
  ✓ Certificate packages found
  ✗ Package 'acme-ext-v2' not found in internal registry

Aborting. Fix the above before generating config files.
```

On success:

```
  ✓ All validations passed

Generating config files → ./output/acme-prod-us-east-1/
  ✓ config-file-1.yaml
  ✓ config-file-2.json
  ✓ config-file-3.conf

Done. Review output/ then proceed with install.
```

## Tech Stack

- **Language:** Python 3.10+
- **Templating:** Jinja2
- **AWS:** boto3
- **CLI prompts:** simple `input()` or `questionary` for nicer UX
- **Config parsing:** PyYAML
- **No framework required** — this is a straightforward CLI script

## Out of Scope (for now)

- Web UI (CLI first; UI can come later if this becomes widely used)
- Secrets storage (fetch-only, never write)
- Triggering the actual install run (generate files only)
- Automated sync of `values/` from infrastructure sources (manual update for now)

## Open Questions to Resolve Before Building

These require domain knowledge that should be confirmed against real config files:

1. What are the actual config files being generated? (names, formats, count)
2. What are the true human inputs vs derivable values?
3. What secrets manager is available in this environment?
4. What internal endpoints or registries need to be validated against?
5. Are there multiple install variants / profiles, or one standard shape?
