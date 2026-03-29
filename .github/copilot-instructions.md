# Copilot Instructions

## Purpose and Maintenance

This document defines rules that Copilot and other automated tools must follow when working in this repository.

The goals are to:
- Reduce ambiguity
- Prevent common failure modes
- Keep generated output safe to run across environments

These instructions may be extended over time. When adding new rules:
- Keep them explicit and actionable
- Prefer constraints that prevent whole classes of errors
- Document intent briefly and clearly

If a rule here conflicts with other guidance, this document takes priority.

## Instructions

### Character Encoding in Scripts

When writing scripts or any text intended to be executed or parsed by another program, always use UTF-8 characters only.

Do not use (even in comments):
- ASCII-only assumptions
- Emojis
- Em dashes or en dashes
- Smart quotes or curly apostrophes
- Any characters that may vary by editor, locale, or runtime encoding

Rationale:
Scripts in this repository may be run in environments with different default encodings. Restricting characters helps prevent syntax corruption, parsing errors, and cross-platform failures.

When unsure, use only:
- Letters and numbers
- Spaces
- Simple punctuation such as -, _, ., /