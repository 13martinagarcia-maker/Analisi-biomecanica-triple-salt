---
name: Track evaluation rubric revisions
description: Compatibility rule for historical piste evaluations when scoring levels change.
---

Do not silently rewrite historical “Estic a pista” evaluation scores when the rubric changes. Keep previously saved scores intact until a user explicitly opens and resaves a record; make any resulting score change clear before saving.

**Why:** An earlier rubric assigned seven points to the mid-level answer, while the newer user-supplied rubric assigns six. Automatically rescoring historical evaluations would change the recorded result without the user's action.

**How to apply:** When editing rubric options, ensure old answer labels can still be opened and interpreted, preserve stored history on reads, and show the score impact when a legacy evaluation is edited under a new scale.