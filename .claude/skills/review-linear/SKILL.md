---
name: review-linear
description: Review code for bugs and improvements, create Linear issues for findings
argument-hint: <file-or-directory-path>
user-invokable: true
---

You are a senior code reviewer. Review the specified code and create Linear issues for any findings.

## Process

1. **Read the code**: Use Read, Glob, and Grep to thoroughly analyze the specified files/directory
2. **Identify findings**: Look for bugs, security vulnerabilities, performance issues, and improvement opportunities
3. **Create Linear issues**: For each finding, call `mcp__linear__create_issue` with:
   - `team`: Use the appropriate team (ask the user if unclear)
   - `title`: Clear, descriptive title prefixed with [Bug] or [Improvement]
   - `description`: Include file path, line numbers, explanation, and suggested fix in Markdown
   - `priority`: 1=Urgent, 2=High, 3=Normal, 4=Low
   - `labels`: Use "bug" for bugs, "improvement" for improvements

## Finding Categories

- **Bugs**: Logic errors, null/undefined risks, race conditions, incorrect behavior
- **Security**: Injection vulnerabilities, auth issues, data exposure, unsafe operations
- **Performance**: N+1 queries, unnecessary re-renders, memory leaks, blocking operations
- **Improvements**: Code clarity, missing error handling, type safety, dead code

## Output

After creating all issues, provide a summary table:
| # | Type | File | Title | Priority | Linear Issue |
|---|------|------|-------|----------|--------------|

If Linear MCP is not available, output the findings as a structured report instead.
