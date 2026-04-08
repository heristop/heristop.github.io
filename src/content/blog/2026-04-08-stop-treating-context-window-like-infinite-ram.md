---
title: "Stop treating your context window like infinite RAM"
description: "Most developers hand their AI agent an entire codebase and wonder why the answers degrade by turn 10. Context windows aren't free — they're a budget. Here's how to spend them wisely."
pubDate: "2026-04-08"
conclusion: "☝ The best AI-assisted developers aren't the ones who give the most context. They're the ones who give the right context — at the right moment, in the right shape. Treat the context window like a budget, not a dump."
tags: ["ai", "llm", "claude-code", "developer-experience", "context-window"]
---

There's a pattern I keep seeing on developer forums and in AI-assisted workflow threads. Someone pastes their entire `src/` directory into a prompt, asks the agent to "fix the bug in the auth module," and then complains that the output is vague, wrong, or contradicts something the agent said three turns ago.

The usual diagnosis: *"LLMs just can't handle large codebases."*

The real diagnosis: **they're treating the context window like infinite RAM.**

## What the context window actually is

Every LLM interaction happens inside a fixed window — call it 128k tokens, 200k, whatever your model offers. Everything goes into this window: your system prompt, the conversation history, every file you attached, every tool call result, the model's own previous responses.

It fills up fast. And as it fills, something subtle happens: **the model's attention dilutes.** Research on long-context transformers consistently shows that retrieval quality degrades for tokens buried deep in a full context — a phenomenon sometimes called "lost in the middle." The model isn't hallucinating. It's averaging over noise.

Giving an agent 200 files doesn't make it smarter. It gives it 200 things to half-pay attention to.

## The RAM analogy breaks down fast

We're used to thinking about RAM as additive: more = better. Load your entire dataset into memory and your program runs faster.

Context windows don't work that way. They're closer to **working memory** than RAM — the seven-plus-or-minus-two things a human can hold in mind at once. Overload working memory and performance doesn't plateau, it collapses. You get slower reasoning, missed connections, and confident wrong answers.

The difference is that RAM doesn't degrade gracefully. A context window does, which makes the failure mode invisible until it bites you.

## What a context budget looks like in practice

I've started thinking of every interaction with a coding agent in terms of **budget lines**:

| Slot | What goes here | Typical cost |
|---|---|---|
| System prompt | Persona, rules, project conventions | Fixed overhead |
| Task definition | The actual thing I want | Small — be precise |
| Reference material | Only what the task directly touches | Variable — this is where overspending happens |
| History | Prior turns the model needs | Grows with conversation length |
| Tool results | File reads, grep output, build logs | Often the biggest leak |

Most developers overspend on reference material and tool results. They attach entire modules when the task only touches two functions. They paste full test suites when only three failures matter. They ask for a grep and get 800 matching lines back unfiltered.

Every token you burn on context you don't need is a token that isn't available for reasoning.

## Three habits that help

### 1. Slice, don't dump

Instead of giving the agent an entire file, give it the relevant class or function — with a one-line comment explaining why you chose it. Instead of attaching a full test output, grep for the failing tests only.

This isn't hiding information. It's editorial work. You already know what's relevant; help the model skip to it.

### 2. Reset early, not late

Most people let conversation threads run for 20+ turns before acknowledging that the model has lost the thread. By then, the first half of the context is noise and the model is reasoning from a distorted picture.

Reset sooner. Start a fresh conversation for a new sub-task. The five seconds it costs to re-establish context is cheaper than the 30 minutes of debugging a confident-but-wrong suggestion.

### 3. Use sub-agents for heavy reads

Tools like Gemini CLI and Claude Code support isolated sub-agents that do their own context-heavy investigation and return a compressed summary. The main agent sees the summary — maybe 2,000 tokens — not the 50,000 tokens of intermediate reasoning.

This is the architectural answer to the problem. You're not fighting the context limit. You're routing around it by design.

## The deeper issue

The urge to give maximum context comes from a reasonable place: we've been burned by agents that miss crucial details, so we preemptively stuff everything in. It feels responsible.

But it's the same mistake as writing a method that takes 15 parameters "just in case." The surface area grows faster than the coverage. You end up with a fragile, hard-to-reason-about system — except the system is a conversation, and the person debugging it is you, in real time.

Good context design is the same as good API design: opinionated, minimal, purposeful. You decide what matters. You shape the interface. You own the failure mode.

## A useful rule of thumb

Before pasting anything into a prompt, ask: *"Would a senior developer unfamiliar with this codebase need this to solve the task?"*

If the answer is no, leave it out.

If the answer is maybe, leave it out and add it only if the first response asks for it.

If the answer is yes, include it — but trim aggressively.

---

The context window is not infinite. It is not even large, relative to what most of us want to throw at it. Treat it like the scarce, degradable resource it actually is, and your AI-assisted work will get noticeably sharper — without changing models, without better prompts, without any new tooling.

Just better editorial discipline.
