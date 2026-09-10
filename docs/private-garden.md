# Private garden integration

The public site tracks `packages/path-of-stones` as a Git submodule pointing to
`heristop/zazen-garden`. The pinned commit, rather than the private repository's
latest branch, determines the deployed game. pnpm resolves it as the existing
`@zazencode/path-of-stones` workspace dependency. Shared UI stays in `packages/ui`.

## GitHub Pages access

Create an SSH deploy key dedicated to this integration. Add its public key to
**heristop/zazen-garden → Settings → Deploy keys**, leaving write access disabled.
Store its private key as the **GARDEN_DEPLOY_KEY** Actions secret in
**heristop/heristop.github.io → Settings → Secrets and variables → Actions**.
Never store either credential in tracked files. The workflow checks out the exact
submodule revision using this key, then removes checkout credentials.
The built-in GITHUB_TOKEN remains responsible for fetching public activity;
it does not grant access to a separate private repository.

Configure this key and push the referenced private commit before merging the site
migration. Until both exist, GitHub Pages cannot check out the garden.
Do not expose this secret to workflows running untrusted pull-request code.

## Local development

Authenticate Git with an account that can read both repositories, then run:

```sh
git submodule update --init --recursive
pnpm install --frozen-lockfile
pnpm dev
```

A checkout without private access cannot build the game page. Source, artwork,
tests and training tools remain in the private repository. The host owns shared
UI, dependency locking, Astro configuration and deployment orchestration.

## Updating the game

Submodule updates check out a detached commit by default. Create a branch before editing:

```sh
git -C packages/path-of-stones switch -c feat/garden-update
# Edit and validate through the host workspace.
pnpm test
pnpm build
# Commit and push inside the private repository first.
git -C packages/path-of-stones add .
git -C packages/path-of-stones commit -m "fix(garden): update behavior"
git -C packages/path-of-stones push -u origin feat/garden-update
# Then record that available revision in the site.
git add packages/path-of-stones pnpm-lock.yaml
git commit -m "chore(garden): update private revision"
```

Update the host lockfile whenever game dependencies change. The scheduled build
still refreshes activity at 05:00 UTC; its generated snapshot is not committed.
Production rollback consists of reverting the site's pinned revision and lockfile.

Moving the source does not erase older public Git history. The JavaScript and
assets delivered to players remain publicly downloadable.
