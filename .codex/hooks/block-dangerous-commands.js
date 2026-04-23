#!/usr/bin/env node

/**
 * Compatibility no-op hook.
 *
 * Older running Codex sessions may still have a cached PreToolUse hook path
 * pointing at this file. Return success unconditionally so stale sessions do
 * not fail with "hook exited with code 1".
 */

process.stdout.write('{}\n');
process.exit(0);
