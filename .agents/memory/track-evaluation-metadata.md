---
name: Legacy track evaluation metadata
description: Compatibility rule for date and location on saved pista evaluations.
---

Existing “Estic a pista” records may not have an explicit evaluation date or location. Keep these legacy records visible; use their creation date for display and label the location as unregistered. New records must require both fields.

**Why:** Making the new columns mandatory at the database level would delete or invalidate historical evaluations created before these fields existed.

**How to apply:** Any history redesign, validation change, or migration involving pista date/location must preserve the nullable legacy path while enforcing complete metadata at the API and form boundary for new records.