# Windows release process

Hearth releases are built from a clean tagged commit. A locally assembled installer is never the
release source of truth.

## Release candidate

1. Update `package.json`, `package-lock.json`, `CHANGELOG.md`, and current-status documentation.
2. Run `npm ci`, `npm run verify`, `npm run package:dir`, `npm run test:packaged`, and the isolated
   live-provider and health drills described in the reviewer guide.
3. Install over the previous version, verify retained Hearth data, then uninstall and reinstall into
   an isolated test profile.
4. Commit and push the clean source, then create and push `v<version>`.

## Signing

The tagged workflow expects an Authenticode certificate in the `CSC_LINK` repository secret and its
password in `CSC_KEY_PASSWORD`. Electron Builder accepts a base64-encoded certificate or protected
certificate URL. The workflow checks the finished installer with `Get-AuthenticodeSignature` and
stops before publication unless Windows returns `Valid`.

Timestamping must remain enabled so a published installer stays valid after certificate expiry.
Certificate rotation and access should be limited to the release owner and GitHub Actions.

## Publication and rollback

The workflow publishes a GitHub prerelease containing the signed NSIS installer, its block map, and
SHA-256 checksum. Automatic in-app updating is intentionally absent during pre-1.0; release notes must
state that installing the previous signed build is the rollback path. Hearth application data remains
outside the installation directory and should be backed up from Home before changing versions.

Promote a prerelease only after the daily-driver soak has no unresolved data-loss, project-identity,
terminal-input, provider-recovery, or migration defects.

