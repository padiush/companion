# Contributing

Padiush Companion is research software. It is published so that researchers can
inspect how captured data is stored and transmitted, and so that anyone running
their own Padiush instance can build a client against it.

## What to expect from us

This is maintained by a very small team alongside other work. Issues and pull
requests are welcome, but there is **no support commitment and no response-time
guarantee**. If you depend on Padiush for fieldwork, run your own instance and
pin a version you have tested.

## Signing your work

Contributions must be signed off under the
[Developer Certificate of Origin](https://developercertificate.org/). This is a
statement that you wrote the patch, or otherwise have the right to submit it
under the project's licence. It is not a copyright assignment — you keep your
copyright.

Add the sign-off by committing with `-s`:

```bash
git commit -s -m "fix: ..."
```

That appends a line to your commit message:

```
Signed-off-by: Your Name <your.email@example.com>
```

Use your real name. Anonymous or pseudonymous sign-offs cannot be accepted,
because the certificate has to mean something.

The full text of the certificate:

```
Developer Certificate of Origin
Version 1.1

Copyright (C) 2004, 2006 The Linux Foundation and its contributors.

Everyone is permitted to copy and distribute verbatim copies of this
license document, but changing it is not allowed.

Developer's Certificate of Origin 1.1

By making a contribution to this project, I certify that:

(a) The contribution was created in whole or in part by me and I
    have the right to submit it under the open source license
    indicated in the file; or

(b) The contribution is based upon previous work that, to the best
    of my knowledge, is covered under an appropriate open source
    license and I have the right under that license to submit that
    work with modifications, whether created in whole or in part
    by me, under the same license (unless I am permitted to submit
    under a different license), as indicated in the file; or

(c) The contribution was provided directly to me by some other
    person who certified (a), (b) or (c) and I have not modified
    it.

(d) I understand and agree that this project and the contribution
    are public and that a record of the contribution (including all
    personal information I submit with it, including my sign-off) is
    maintained indefinitely and may be redistributed consistent with
    this project or the open source license(s) involved.
```

## Working on the code

Setup is in the [README](README.md). Two conventions the history follows:

- **Changes ship with their tests.** The suites are the reason a change can be
  trusted; a pull request that adds behaviour without covering it will be asked
  for tests.
- **Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)**
  and describe the outcome rather than the mechanics — `git log` is the best
  guide to the house style.

## Never commit research data

Interview records, audio, photographs and any store pulled off a device belong
to the researcher who collected them, not to this repository. Database and
spreadsheet extensions are gitignored for that reason: encryption protects the
store at rest on the phone, and does nothing once a decrypted copy is committed.
If you are reporting a bug, construct a synthetic fixture — never attach a real
capture to an issue.

## Security

If you believe you have found a vulnerability, please do not open a public
issue. Report it privately through GitHub's security advisory form on this
repository.
