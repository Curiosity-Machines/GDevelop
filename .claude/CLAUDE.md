<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `../openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `../openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

## OpenSpec CLI Limitation

The `openspec` CLI only works from the **project root directory**, not from `.claude/`.

**When running openspec commands:**
```bash
cd /Users/michaelfinkler/Dev/Dopple/dopple-studio && openspec list
```

**When reading openspec files from agents:**
- Use relative paths: `../openspec/AGENTS.md`, `../openspec/project.md`