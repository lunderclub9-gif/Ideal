# IDEAL — Isolated simulation and test data

IDEAL must never create demonstration records in a real company database.

## Run the business workflow simulation

```bash
npm run test:simulation
```

The script `scripts/test-simulation.ts` starts a separate local server on a dynamically selected loopback port and sets both `IDEAL_DATA_DIR` and `GESTIONPRO_DATA_DIR` to a unique temporary directory created under the operating system temp folder.

It simulates:
- first-run company and administrator setup;
- dashboard access;
- client and project creation;
- worker creation and attendance entry;
- invoice issuance;
- expense creation and its treasury movement;
- lifecycle overview;
- creation and verification of a backup.

The temporary directory is removed after the server stops, including when a test fails.

## Other automated checks

- `npm run test:data-protection`: backup, restore, archive integrity, path traversal and session signature tests.
- `npm run test:lifecycle`: seven-day eligibility, linked-record protection, archive/restore and annual review rules.
- `npm run test:e2e`: Playwright first-run setup test. It starts its own server with `reuseExistingServer: false`, uses port 3187 and the ignored `e2e-data` directory.
- Windows CI runs a packaged-app smoke test with a temporary AppData directory and verifies setup, backup/restore, restart and login persistence.

## Database isolation guarantees

- The database path resolver prioritizes `IDEAL_DATA_DIR`; therefore every script that starts a test server sets **both** data-directory variables to the same temporary path.
- The Electron packaged smoke test sets an isolated user-data directory and both database variables.
- The Playwright test server uses a dedicated port and refuses to reuse any already-running local server.
- The test scripts never seed the actual user's company database and never require demo data in production.
