---
name: code-review
title: Code Review
description: Reviews a pull request or diff for correctness bugs, simplification opportunities, and efficiency improvements. Returns findings grouped by severity.
author: anthropic
authorUrl: https://anthropic.com
category: engineering
tags:
  - code-quality
  - pull-requests
  - review
version: "1.0.0"
effort: medium
invocation: /code-review
published: true
publishedAt: "2024-01-15"
---

## Overview

The **Code Review** skill performs a structured review of your current diff or a GitHub pull request. It groups findings by severity — correctness bugs first, then simplification and efficiency suggestions — and can optionally post findings as inline PR comments or apply fixes directly to your working tree.

## Usage

```
/code-review             # Review current diff (medium effort)
/code-review high        # Broader coverage, may include uncertain findings
/code-review ultra       # Deep multi-agent review in the cloud
/code-review --comment   # Post findings as inline PR comments
/code-review --fix       # Apply findings to the working tree
```

## Parameters

| Parameter  | Description |
|------------|-------------|
| `low`      | Fewer, high-confidence findings only |
| `medium`   | Balanced coverage (default) |
| `high`     | Broader coverage, may include uncertain findings |
| `ultra`    | Deep cloud-based multi-agent review |
| `--comment`| Post results as inline GitHub PR comments |
| `--fix`    | Automatically apply suggested fixes |

## What it checks

- **Correctness** — logic errors, off-by-one bugs, unhandled edge cases, type mismatches
- **Simplification** — duplicated code, unnecessary abstraction, simpler stdlib alternatives
- **Efficiency** — algorithmic improvements, unnecessary re-renders, redundant network calls

## Requirements

- Must be run inside a git repository
- For `--comment`, requires `gh` CLI authenticated to GitHub
- For `ultra`, requires a GitHub remote and active Claude Code subscription
