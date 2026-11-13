# Contributing

Thanks for helping with second-brain-os. This page is how a change gets in.

## Making a change

1. Branch off `main` as `<type>/<slug>`, for example `feat/search-filters` or `fix/null-date`. The types are `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `build`, `ci`, `chore`, `style` and `revert`.
2. Add tests with the change. A bug fix starts with a failing test.
3. Run the repo's gates locally; they are the same ones CI runs.
4. Open a pull request titled `type(scope): summary`, for example `feat(search): add filters`. CI checks the title and the branch name. The title becomes the commit on `main`, and it decides the next version: `feat` is a minor release, `fix` a patch, and `!` or a `BREAKING CHANGE:` footer a major one. Other types release nothing.
5. A maintainer squash-merges it. One commit lands on `main` with your title.

Urgent fixes follow the same path as any `fix/<slug>` branch. There is no separate hotfix branch.

## Collaboration

Right now collaboration means opening pull requests: fork the repo, or push a `<type>/<slug>` branch if you were invited, then open a PR. You do not need to sign commits. Only the maintainer merges and tags.

## Releases

Nobody but the maintainer releases. release-please keeps a `chore(main): release x.y.z` pull request and a draft release up to date but creates no tag. The maintainer merges that PR, signs the tag (`git tag -s x.y.z`) and pushes it; the release workflow then checks the tag, waits for the maintainer's approval and publishes.

## License

By contributing you agree that your contribution is licensed under the project's license (see `LICENSE`).

## Reporting bugs

Use the bug template and include the version and your platform.
