# Engineering documents

These documents record how Free My Vizio was researched, designed and built. They're kept for contributors and for
anyone curious about how a Vizio SmartCast TV works under the hood. **For installing and using the project, see the
[README](../../README.md) and the guides in [docs/](../).**

Several documents were written as hand-offs between a design/research phase and an implementation phase, so they use
words like "binding" and "implementation agent", and some sections describe plans that later changed. When a document
and the code disagree, the code and the user guides are current; [DEVIATIONS.md](DEVIATIONS.md) explains the approved
changes.

| Document | What it is |
|---|---|
| [RESEARCH_SUMMARY.md](RESEARCH_SUMMARY.md) | Two-minute overview of what is and isn't possible on a SmartCast TV |
| [TECHNICAL_FEASIBILITY.md](TECHNICAL_FEASIBILITY.md) | Evidence: SmartCast API capability matrix, Conjure runtime findings, proof-of-concept results, firmware/privacy research |
| [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) | Requirements, non-goals and acceptance criteria |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Server/TV architecture, takeover state machine, API, security model |
| [DESIGN_SPEC.md](DESIGN_SPEC.md) | UI/UX specification; §14 "Cinematic Lite" performance revision |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | Original milestones M0–M9 |
| [IMPLEMENTATION_AGENT_PROMPT.md](IMPLEMENTATION_AGENT_PROMPT.md) | Hand-off prompt used for implementation |
| [REVIEW_2026-10-27.md](REVIEW_2026-10-27.md) | Post-implementation review task list |
| [DEVIATIONS.md](DEVIATIONS.md) | Approved changes to the original plans (Docker Desktop networking, Cinematic Lite, fireplace removal) |
| [MANUAL_TESTS.md](MANUAL_TESTS.md) | Results of tests run on the real TV |
| [ORIGINAL_BRIEF.md](ORIGINAL_BRIEF.md) | The original project brief |

Related: [../evidence/](../evidence/README.md) (sanitised captures from the target TV, also used as test fixtures) and
[../../poc/](../../poc/README.md) (the research proof-of-concept tool).

## Notable changes since these documents were written

- The **fireplace screensaver** in DESIGN_SPEC §6 was removed (failed real-TV performance tests).
- The ambient/motion effects were simplified to **Cinematic Lite** (DESIGN_SPEC §14).
- Docker Desktop requires bridge networking plus `server.publicBaseUrl` (DEVIATIONS).
- The TV home currently shows the **Apps** row only; inputs and SmartCast Home are reached from the admin app.
