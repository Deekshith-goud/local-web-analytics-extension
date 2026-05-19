## Description

Provide a clear and concise description of the changes introduced by this pull request. Explain the rationale and architectural decisions behind your approach.

## Associated Issue

Fixes # (issue reference, if any)

## Type of Change

Please tick the options that are relevant:

- [ ] `feat`: A new feature
- [ ] `fix`: A bug fix
- [ ] `refactor`: A code change that neither fixes a bug nor adds a feature
- [ ] `perf`: A code change that improves performance
- [ ] `docs`: Documentation updates
- [ ] `security`: Security patches or permission restrictions
- [ ] `chore`: Build process or auxiliary tool changes

## 🔒 Security & Privacy Checklist

Every pull request must adhere to the project's strict privacy-first architecture. Please verify the following checks:

- [ ] **100% Local**: The code does NOT initiate any external fetch, XMLHttpRequest, WebSocket, or script injection.
- [ ] **No Telemetry**: There is no tracking code, telemetry collection, or remote crash reporting added.
- [ ] **Least Privilege**: The PR does not introduce new Chrome Extension permissions to `package.json` unless explicitly justified and approved.
- [ ] **Audited Locally**: I have run `bun run package` and verified that the security/integrity audit runs successfully with **zero errors**.
- [ ] **No Secrets**: I have checked the code for hardcoded secrets, dev tokens, or security fixtures.

## 🛠️ Verification & Test Plan

### Steps performed to verify the changes:
1. ...
2. ...

### Verification Output:
Please paste logs or screenshots of tests running successfully (without leaking sensitive details).
