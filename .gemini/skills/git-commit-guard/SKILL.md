---
name: git-commit-guard
description: Guide for creating effective git commit messages and ensuring proper commit timing based on best practices. Use this skill when the user wants to commit code, asks about commit message conventions, or asks about when/how to commit.
---

# Git Commit Guard

## Overview

This skill ensures that all Git commits adhere to established best practices regarding message formatting and timing. It helps maintain a clean, readable, and manageable project history.

## Workflow

When the user requests to commit code or asks for advice on committing:

1.  **Analyze the Changes**:
    *   Check `git status` and `git diff` to understand what is being committed.
    *   **Rule Check**: Are the changes related? If not, advise splitting them into separate commits.
    *   **Rule Check**: Is the work complete and tested? If not, advise against committing or suggest `git stash`.

2.  **Draft the Commit Message**:
    *   **Summary Line**: Create a concise summary (< 50 chars), capitalized, in imperative mood (e.g., "Add user login" not "Added user login").
    *   **Body**: If necessary, provide a detailed explanation separated by a blank line, wrapped at 72 chars. Explain *why* and *how* it changed.

3.  **Execute (or Suggest)**:
    *   If the user asked you to commit, present the planned message and verify the `git add` strategy.
    *   If the user asked for advice, provide the formatted message and explain the rules applied.

## Reference Rules

For detailed rules on message formatting and commit timing, refer to [git_best_practices.md](references/git_best_practices.md).

### Quick Checklist

- [ ] **Atomic**: Does this commit do one thing?
- [ ] **Complete**: Is the code tested and working?
- [ ] **Imperative**: Does the message start with a verb like "Fix", "Add", "Update"?
- [ ] **Concise**: Is the first line under 50 chars?
- [ ] **Detailed**: Is there a body explaining "why" if complex?