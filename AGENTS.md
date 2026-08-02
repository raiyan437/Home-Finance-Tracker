# Project working rules

- After making any project change, run the relevant checks and start the application locally so the updated behavior can be viewed and smoke-tested.
- When the requested work and validation are complete, automatically stage only the task-scoped changes, create a clear Git commit, and push it to the repository branch that updates the live application (`main` unless the user specifies another workflow).
- Do not push changes that fail required checks. If authentication, permissions, unresolved merge conflicts, destructive operations, or another safety requirement blocks publishing, report the blocker and resume automatically once it is resolved.
- Preserve unrelated user changes and never include them in a commit without clear authorization.
