# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Use GitHub's
[private vulnerability reporting](https://github.com/aml-wajeh/FrontalOS/security/advisories/new)
instead. I aim to reply within 7 days.

## Scope and design notes

- **Research prototype.** FrontalOS is not a medical device and is not deployed for real users.
- **No secrets in the repo.** Configuration comes from `.env` files, which are git-ignored. `.env.example` holds placeholders only.
- **Camera frames.**
  - The v2 engine is designed to run on the user's own machine.
  - Frames are processed in memory and never written to disk.
  - Only aggregated scores leave the inference engine.
- **Auth (platform).**
  - bcrypt password hashing.
  - Short-lived JWT access tokens plus refresh tokens.
  - JWTs are kept in httpOnly cookies behind a Backend-for-Frontend proxy, so the browser never sees raw tokens.
- **Automated checks on every push.** CodeQL static analysis, Dependabot dependency alerts, and GitHub secret scanning.
