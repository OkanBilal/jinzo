---
name: review-code
description: Performs a thorough code review with security, performance, and maintainability checks
---

# Code Review Skill

When reviewing code, analyze the following aspects:

## 1. Security
- Check for injection vulnerabilities (SQL, XSS, command injection)
- Look for hardcoded secrets or credentials
- Verify input validation and sanitization
- Check authentication and authorization patterns

## 2. Performance
- Identify N+1 query problems
- Look for unnecessary re-renders (React)
- Check for memory leaks
- Review algorithm complexity

## 3. Code Quality
- Check naming conventions and readability
- Look for code duplication
- Verify error handling
- Review type safety

## 4. Best Practices
- Check for proper async/await usage
- Verify resource cleanup
- Look for anti-patterns
- Review test coverage

## Output Format

Provide findings in this format:

```
## Summary
[Brief overview]

## Critical Issues
- [Issue]: [Location] - [Explanation]

## Suggestions
- [Improvement]: [Why it helps]

## Positive Observations
- [What's done well]
```
