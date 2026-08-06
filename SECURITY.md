# Security policy

## What is supported

VOLO is a website that is continuously deployed, not a product with releases.
There are no version numbers to support and no older versions to patch.

| What | Supported |
|---|---|
| volobg3.com, as currently deployed | Yes |
| `main` | Yes |
| Any older commit, branch or fork | No |

Fixes land on `main` and deploy from there. If you are running a fork, update it
from `main` rather than waiting for a patch release, because there will not be
one.

## What is in scope

- **The site itself.** Anything that could expose or exfiltrate the load order a
  visitor opens, which is meant never to leave their browser.
- **`functions/api/submit.js`.** The one endpoint that accepts input. Injection,
  bypassing the anti-spam check, or getting it to write somewhere it should not.
- **The build and mining scripts.** Anything that lets a submitted load order
  influence the masterlist beyond the placement it argues for, or execute during
  a build.
- **The workflows in `.github/workflows`.** Anything that lets a submission
  reach a repository secret or push content nobody reviewed.

## What is not in scope

- **Advisories against development dependencies** that only affect a dev server.
  VOLO ships a static build; `vite` and `esbuild` never run in production. These
  are tracked, and they are not treated as vulnerabilities in the deployed site.
- **The mods themselves.** VOLO reads names and identifiers out of a load order
  file. It does not download, inspect or execute mod content, and it makes no
  claim about whether a mod is safe to install.
- **Reports produced by a scanner with nothing behind them.** Please confirm the
  behaviour against the live site or a local build first.

## Reporting a vulnerability

Use GitHub's **Report a vulnerability** button on the Security tab. That opens a
private advisory only the maintainer can see, which is the right place for
anything that should not be public yet.

If that is unavailable to you, open an issue describing the shape of the problem
without the details needed to reproduce it, and say you have something to share
privately.

Please do not post a working exploit in a public issue.

## What to expect

VOLO is maintained by one person as a community project, so the honest answer is
days rather than hours, and longer if it lands badly in a week.

- **Acknowledgement:** within a week.
- **An assessment:** once it has been reproduced, with a plain statement of
  whether it is accepted, and why if it is not.
- **A fix:** deployed as soon as it is ready. There is no release train to wait
  for, so a real fix usually ships the day it is written.
- **Credit:** in the advisory and the commit, unless you would rather not be
  named.

If something is being actively exploited, say so plainly at the top of the
report and it will jump the queue.

## Known advisories

None open. Four development server advisories against `vite` and `esbuild` were
cleared by upgrading to Vite 8, which also required declaring `esbuild` as a
direct dependency, since Vite 8 no longer supplies it.

This section exists so that open advisories are never mistaken for unnoticed
ones. If it says none, check the Security tab rather than trusting it: a
sentence in a file cannot go stale as loudly as a dashboard.
