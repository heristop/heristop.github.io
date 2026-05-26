---
title: "From data to deck: frontend insights at Carrefour"
description: "Five months after the Frontend Observatory, two new deliverables: a per-project dashboard and auto-generated slideshows scoped to each Digital Factory — deployed on GitLab Pages, exportable, ready for performance reviews."
pubDate: "2026-05-26"
image: "/images/posts/2026-05-26-gitlab-frontend-insights-df-slideshow/slideshow-banner.png"
tags: ["case-study", "carrefour", "gitlab", "frontend", "design-system", "tooling", "tech-score"]
conclusion: "The tool started as a way to turn raw GitLab data into a readable picture. It's now become the backbone of our frontend performance reviews. The gap between 'we have data' and 'we use data' turned out to be a UX problem as much as a data problem."
---

Five months ago I wrote about **[how we built a 360° Frontend Observatory at Carrefour](https://heristop.github.io/blog/2025-11-28-frontend-observatory-design-system-ast/)** — scanning hundreds of frontend repos twice a week via AST parsing to measure Marcel adoption, Tech Radar compliance, accessibility, and more.

That post covered the foundation: what we track, how we compute it, why raw npm install counts don't tell you anything useful. This one is about **what we built on top of it**.

## The problem with global views

The Observatory gave us a platform-wide picture. Useful for spotting trends, less useful for accountability. When a Tech Manager asks "how is *my* perimeter doing?", a **500-project dashboard isn't the answer**.

Two things were missing: a way to **drill down to a single project**, and a way to **scope the whole analysis to a given Digital Factory**.

<div class="img-container">
  <figure class="img-figure">
    <img
      src="/images/posts/2026-05-26-gitlab-frontend-insights-df-slideshow/home-dashboard.png"
      alt="GitLab Frontend Insights homepage showing 551 active projects, 64% C4 compliance, 16% Marcel adoption"
      class="img-three-quarter img-rounded"
      style="width: 85%;"
    />
    <figcaption class="img-caption">
      551 active projects · 64% C4 compliance · 16% Marcel adoption. Software Factory #1 in the DF leaderboard at 75/100.
    </figcaption>
  </figure>
</div>

## New deliverable #1: the per-project view

The first addition is straightforward but was the most-requested: each project now has its own page. Before, you could see a project in a table row. Now you can open it, get a **full breakdown of its C4 compliance** across all six categories, see its framework and dependency tree, track vulnerabilities, and read its Marcel and accessibility scores.

<div class="img-container">
  <figure class="img-figure">
    <img
      src="/images/posts/2026-05-26-gitlab-frontend-insights-df-slideshow/project-nuxt-kit.png"
      alt="Nuxt Kit project detail page — 90/100 C4 score, Nuxt + Vue, Software Factory"
      class="img-three-quarter img-rounded"
      style="width: 85%;"
    />
    <figcaption class="img-caption">
      Nuxt Kit · 90/100 C4 · Nuxt + Vue · 8 vulnerabilities. The radar chart shows exactly where points are lost.
    </figcaption>
  </figure>
</div>

The C4 score breakdown at the project level is **fully auditable** — every point is explained by the raw project fields, so a team can see exactly what they need to fix to move the needle.

## New deliverable #2: auto-generated slideshows per Digital Factory

This is the more ambitious piece. The idea: each Digital Factory gets its own presentation deck, generated automatically from the latest scan, deployable on GitLab Pages, exportable as PNGs.

The use case is concrete — these decks are used as **performance review supports for Tech Managers and CTOs**. No prep work, no copy-pasting metrics into slides. **The deck is live data.**

<div class="img-container">
  <figure class="img-figure">
    <img
      src="/images/posts/2026-05-26-gitlab-frontend-insights-df-slideshow/slideshow-banner.png"
      alt="Slideshow title slide filtered on Software Factory — State of the frontend, scoped to 10 repos"
      class="img-three-quarter img-rounded"
      style="width: 85%;"
    />
    <figcaption class="img-caption">
      Software Factory · 21 slides · 10 repos · Main inventory + Marcel chapters · snapshot May 19, 2026.
    </figcaption>
  </figure>
</div>

The filter recomputes the entire deck client-side: metrics, charts, Top 3, everything is recalculated for the filtered scope. The `FILTERED · SOFTWARE FACTORY` badge in the top-right corner confirms the active scope at all times.

### What's inside a deck

The deck covers two chapters.

**Main inventory** opens with aggregate metrics — total repos in scope, TypeScript adoption rate with version breakdown, C4 compliance average, testing coverage — followed by chart slides for framework distribution, build tools, and vulnerabilities.

<div style="display: flex; gap: 1.5rem; align-items: flex-start;">
  <figure class="img-figure" style="flex: 1; min-width: 0;">
    <img
      src="/images/posts/2026-05-26-gitlab-frontend-insights-df-slideshow/slide-typescript.png"
      alt="TypeScript adoption slide — 10 repos, 100%, 70% on TypeScript 6.x"
      class="img-rounded"
      style="width: 100%;"
    />
    <figcaption class="img-caption">
      10/10 repos on TypeScript · 70% on TS 6.x · 30% still on 5.x.
    </figcaption>
  </figure>
  <figure class="img-figure" style="flex: 1; min-width: 0;">
    <img
      src="/images/posts/2026-05-26-gitlab-frontend-insights-df-slideshow/slide-framework-distribution.png"
      alt="Framework distribution slide — Nuxt/Vue 30%, Angular 20%, Vue 10%, React Router 10%"
      class="img-rounded"
      style="width: 100%;"
    />
    <figcaption class="img-caption">
      Nuxt+Vue 30% · Angular 20%. Version drift flagged in red against Tech Radar minimums.
    </figcaption>
  </figure>
</div>

Then come the North Stars and top projects — the two slides that generate the most conversation in review meetings. **Marcel design system** is the second chapter — adoption rate, component usage breakdown, token distribution by category, and a list of the top Marcel-enabled projects in scope.

<div style="display: flex; gap: 1.5rem; align-items: flex-start;">
  <figure class="img-figure" style="flex: 1; min-width: 0;">
    <img
      src="/images/posts/2026-05-26-gitlab-frontend-insights-df-slideshow/slide-top10-projects.png"
      alt="Top 10 projects in Software Factory — Nuxt Kit and Vue Kit tied at 90/100"
      class="img-rounded"
      style="width: 100%;"
    />
    <figcaption class="img-caption">
      Top 10 · Nuxt Kit and Vue Kit tied at 90/100. TS and M badges indicate TypeScript and Marcel adoption.
    </figcaption>
  </figure>
  <figure class="img-figure" style="flex: 1; min-width: 0;">
    <img
      src="/images/posts/2026-05-26-gitlab-frontend-insights-df-slideshow/slide-marcel.png"
      alt="Marcel chapter — 8 repos using Marcel, 80% adoption in Software Factory"
      class="img-rounded"
      style="width: 100%;"
    />
    <figcaption class="img-caption">
      8/10 repos using Marcel · 80% adoption · upward trend.
    </figcaption>
  </figure>
</div>

### The export

Each deck has a download button that **exports all slides as individual PNGs**. The intent is simple: Tech Managers can drop them into a presentation or send them in a message without ever touching the tool directly.

## A demo walkthrough

The video below goes through the Software Factory deck from start to finish — filtering, navigating slides, the Marcel chapter, and the export.

<div class="img-container">
  <figure class="img-figure" style="width: 100%; max-width: 48rem;">
    <video controls loop playsinline style="width: 100%; border-radius: 0.5rem; border: 2px solid var(--border-image);">
      <source src="/videos/2026-05-26-gitlab-frontend-insights-df-slideshow/demo.mp4" type="video/mp4" />
      Your browser does not support the video tag.
    </video>
    <figcaption class="img-caption">
      Software Factory deck — filter, navigate, per-project view, PNG export.
    </figcaption>
  </figure>
</div>

## What this is part of

The slideshow and per-project view are the frontend layer of a broader **Tech Score** initiative we're building at the Software Factory — a composite measure of technical maturity across GitLab best practices, security posture, AI adoption (code assist), and frontend quality.

The frontend chapter is the one I'm responsible for. The others are coming.

The pattern across all of them is the same: pull data automatically from GitLab, compute scores, **surface them where decisions are made**. The Tech Score isn't a dashboard you consult once — it's a signal that lands in performance reviews, roadmap conversations, and team retrospectives.

**Data without distribution is just data.**
