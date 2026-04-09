---
title: "Why sub-agents save your context window"
description: "Sub-agents run in isolated context windows, keeping your main session clean and focused. Here's how they work and why they matter for large codebases."
pubDate: "2026-04-08"
image: "/images/posts/2026-04-08-gemini-cli-subagents/poster.webp"
conclusion: "Sub-agents are independent context loops. Heavy work happens somewhere else, only the summary comes back, and you can pick a different model and temperature for each one depending on whether it's doing creative work or mechanical scanning. If you're regularly hitting context limits on big codebases, this is the lever to pull."
tags: ["ai", "tooling", "gemini-cli", "agents", "context-window", "llm"]
---

**Hello AI wizards** 👋

You know that moment, around turn 15 of an agentic session, when your CLI starts giving weirdly vague answers? It "forgets" a file it read ten minutes ago, repeats a grep it already ran, asks you something it should already know. That's the context window filling up with cruft — tool outputs, intermediate reasoning, half-useful file reads — and every new decision is being made on a messier and messier slate.

Gemini CLI's **sub-agents** feature is the cleanest solution I've seen to this problem. As of [v0.37.0](https://geminicli.com/docs/changelogs/latest/) (April 8, 2026), sub-agents are no longer experimental — they're a fully supported, production-ready feature. Worth a post.

## The basic idea

A sub-agent is, from the main agent's point of view, just a tool. You call it with a task, it goes off and does the work, it comes back with a report. The twist is that *everything* that happens inside that sub-agent — every file read, every grep, every intermediate thought, every tool call — lives in a completely separate conversation. The main agent never sees it.

Which means: a sub-agent can chew through 50k tokens investigating your codebase, and the main agent will only see the 2k-token summary it returns. The other 48k never touch your main context.

The official docs call it an "independent context window", and it's exactly that. The pattern works best when the main agent acts as an orchestrator: it treats its own context as its most precious resource, and delegates anything context-heavy to specialists.

<div class="img-container">
  <img src="/images/posts/2026-04-08-gemini-cli-subagents/gemini_cli_subagents_context_saving.svg" alt="Diagram showing how sub-agents isolate context from the main agent" class="img-responsive" />
</div>

## Why this beats "just have a bigger context window"

Gemini models already have a 1M token window, so you might reasonably ask: who cares? Just dump everything in there.

The problem isn't capacity, it's signal. Even at 1M tokens, agents get worse at long-range recall as context grows — it's well documented that models attend less reliably to things buried in the middle of a long history. So even if it *fits*, it doesn't mean the agent will *use* it well by turn 40.

Sub-agents sidestep this by keeping the main agent's history short and focused. The investigation happened, but only the conclusion is remembered.

## What a sub-agent actually looks like

You define one as a markdown file in `.gemini/agents/` (project-level, shared with your team) or `~/.gemini/agents/` (personal). The front matter is where it gets interesting:

```markdown
---
name: security-auditor
description: Finds security vulnerabilities in code.
kind: local
tools:
  - read_file
  - grep_search
model: gemini-2.5-pro
temperature: 0.2
max_turns: 10
---

You are a ruthless security auditor. Your job is to analyze code
for potential vulnerabilities. Focus on SQL injection, XSS, auth
bypasses, and insecure deserialization. When you find an issue,
explain it clearly and suggest a fix. Do not fix the code yourself.
```

The body becomes the sub-agent's system prompt. The `tools` list is a hard restriction — this auditor can only read and grep, it literally cannot touch a file. If omitted, the sub-agent inherits all tools from the parent session. That's not just a safety thing, it's a focus thing: with fewer options the model stops wandering.

### The underrated tip: different models per agent

Notice the `model` and `temperature` fields. Each sub-agent can run on a different model and a different temperature than your main session. From the docs, `model` defaults to `inherit` (same as the main agent), `temperature` defaults to `1` and accepts anything between `0.0` and `2.0`.

This is genuinely underused. A few patterns that work well:

- **Scanners and investigators** (like `codebase-investigator` or the security auditor above) should run at low temperature — `0.2` or so. You want deterministic, reproducible grepping, not creative interpretation.
- **Writers and designers** (docs-writer, API-designer, refactor-planner) can run at `0.8–1.0` where a bit of variation actually helps.
- **Cheap model for the grind, strong model for the thinking.** Pin your investigator to a faster, cheaper model and reserve `gemini-2.5-pro` for the agent that actually writes code. Your main agent orchestrates both. You save tokens *and* money without losing quality where it matters.

There's also `max_turns` (default 30) and `timeout_mins` (default 10) — budgets for the sub-agent. Worth tuning if you've got one that tends to spiral.

## A concrete example

Say you ask the main agent: *"How does our authentication work, and are there any security issues?"*

Without sub-agents, a single agent does everything: greps twenty files, reads the matches, traces imports across modules, reasons about vulnerabilities, writes the report. By the time it gets to the reasoning step, its context is half-full of raw file contents it's already processed once. By the writing step, it's started forgetting things.

With sub-agents, the main agent delegates. `codebase-investigator` goes and maps the auth flow in its own context — reads all the files, traces the dependencies, and returns something like *"JWT-based auth, validated in middleware/auth.ts, three relevant files, no custom crypto."* Then the main agent hands those three files to `security-auditor`, which scans them at temperature 0.2 and returns a list of findings. The main agent now has two clean reports to reason about, and its context is still mostly empty. It can keep going for a long time before anything gets crowded.

## A few things to watch out for

Sub-agents can run in YOLO mode — executing tools without asking for confirmation. A misconfigured one with `write_file` and `run_shell_command` can do real damage before you notice. So be deliberate about the `tools` list. "Read-only for investigators" is a good default rule.

Be careful when parallelizing sub-agents that write to the same files. Read-only work parallelizes fine; mutations can create race conditions.

And don't reach for a sub-agent for every little thing. There's a real round-trip cost to spinning one up. For a two-turn question, just answer it in the main context. Sub-agents pay off when the task is heavy *and* independent — the kind of work where the main agent would otherwise waste a lot of tokens on intermediate state it doesn't actually need to remember.

## Sources

- [Gemini CLI — Subagents (official docs)](https://github.com/google-gemini/gemini-cli/blob/main/docs/core/subagents.md)
- [DeepWiki — Agent Skills and Sub-agents](https://deepwiki.com/google-gemini/gemini-cli/3.11-agent-skills-and-sub-agents)
- [Morph LLM — Gemini CLI Subagents (2026)](https://www.morphllm.com/gemini-cli-subagents)
- [Prashanth Subrahmanyam — Advanced Gemini CLI Part 3: Dynamic Isolated Agents](https://medium.com/google-cloud/advanced-gemini-cli-part-3-isolated-agents-b9dbab70eeff)
