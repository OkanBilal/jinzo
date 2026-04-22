# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |

## Reporting a Vulnerability

**Please do not open a public issue for security vulnerabilities.**

Instead, email **team@mains.dev** with:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

You should receive a response within 48 hours. We will work with you to understand the issue and coordinate a fix before any public disclosure.

## Scope

The following are in scope:

- Path traversal in the file explorer module
- IPC channel authorization bypass
- Credential storage and encryption (`connectionTokens`)
- Command injection via terminal or git modules
- Cross-site scripting (XSS) in the renderer process

## Out of Scope

- Vulnerabilities in third-party dependencies (report upstream)
- Issues requiring physical access to the machine
- Social engineering

## Disclosure

We follow coordinated disclosure. After a fix is released, we will credit reporters (unless they prefer to remain anonymous) in the release notes.
