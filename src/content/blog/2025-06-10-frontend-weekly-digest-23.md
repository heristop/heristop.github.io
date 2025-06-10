---
title: "Frontend Development Weekly Digest 🌸 - Weeks 21-23"
description: Sharing practical tips and the latest trends in JavaScript
pubDate: "2025-06-10"
conclusion: "That's it for this week's frontend digest! What are you most excited about? Happy coding! 🚀"
image: "/images/posts/ferenc-almasi-L8KQIPCODV8-unsplash.jpg"
---

Hello everyone! This edition of the Frontend Digest covers mid-May through early June 2025. We’ve got major framework releases, developer tool upgrades, web platform innovations, industry trends, conference highlights, and a couple of fun demos. Let’s dive in!

## 🔥 Framework Updates

### Angular

* **[Angular 20 Released](https://www.bacancytechnology.com/blog/angular-20?ref=zazen_code)**: Angular v20 officially launched on May 29, 2025, bringing a leap forward in performance and developer experience. This release stabilizes the new Signals reactivity API for state management, introduces an experimental zoneless mode (no Zone.js) for faster change detection, smarter SSR for snappier page loads, and a cleaned-up style guide and CLI. The result is faster, more maintainable Angular apps with less overhead.

### Remix

* **[Remix Reimagined](https://remix.run/blog/wake-up-remix?ref=zazen_code)**: After “taking a nap” to merge much of Remix v2 into React Router 7, the Remix team has “woken up” Remix again. Remix v3 is now being reimagined as a fresh full-stack web framework not tied to React. The new Remix will have zero critical dependencies (not even React) – it’s starting off with a fork of Preact. The focus is on simplicity, performance, and aligning closely with web fundamentals.

### Svelte

* **[Async Svelte](https://svelte.dev/blog/whats-new-in-svelte-may-2025?ref=zazen_code)**: The Svelte core team is working on “Asynchronous Svelte”, enabling `await` directly inside component logic without breaking reactivity. This unlocks new patterns for async rendering and data loading.

### Vue / Nuxt

* **[Nuxt 2025 Roadmap](https://nuxt.com/blog/2025-roadmap?ref=zazen_code)**: Upcoming Nuxt 4 will include support for Vue 3.4+ features and server components. Alpha expected around June 2025.

### React

* **[React Compiler RC](https://react.dev/blog?ref=zazen_code)**: The new compiler (“React Forget”) is now in preview. It enables auto-memoization and performance optimizations by default.
* **[Create React App Deprecated](https://react.dev/blog?ref=zazen_code)**: CRA is now officially deprecated, with modern bundlers like Vite recommended.

## 🛠️ Developer Tools & Libraries

* **[Node.js v24 Released](http://nodesource.com/blog/Node.js-version-24/?ref=zazen_code)**: Comes with npm 11, V8 12.4, and diagnostic improvements.
* **[Sleeker Node.js Experience](https://www.developer-tech.com/news/nodejs-24-a-faster-sleeker-javascript-experience/?ref=zazen_code)**: Coverage of improved module handling and startup time.
* **[Native TypeScript Compiler](https://devblogs.microsoft.com/typescript/typescript-native-port/?ref=zazen_code)**: Written in Go, this new compiler is up to 10× faster and will unlock better IDE performance.
* **[ESLint 9.0.0 Retrospective](https://eslint.org/blog/2025/05/eslint-v9.0.0-retrospective/?ref=zazen_code)**: ESLint v9 now uses flat config by default and removes legacy rule APIs.
* **[ESLint Flat Config Discussion](https://github.com/eslint/eslint/discussions/17468?ref=zazen_code)**: Guidance and migration notes for teams upgrading to ESLint 9.
* **[Anime.js v4 – Announcement](https://x.com/JulianGarnier/status/1905686297525813453?ref=zazen_code)**
* **[Anime.js v4 – Release Notes](https://github.com/juliangarnier/anime/releases?ref=zazen_code)**
* **[Tailwind CSS Blog](https://tailwindcss.com/blog?ref=zazen_code)**
* **[OpenJS Foundation CNA](https://socket.dev/blog/openjs-foundation-is-now-a-cna?ref=zazen_code)**
* **[Storybook 8 Overview](https://storybook.js.org/blog/storybook-8/?ref=zazen_code)**: Adds visual tests, React Server Components support, faster builds, and better mobile UX.
* **[Storybook 9 Preview](https://storybook.js.org/blog/storybook-9/?ref=zazen_code)**: Introduces new architecture and module unification.

## 🌐 Web Standards & Browser Updates

* **[Web at I/O 2025](https://developer.chrome.com/blog/web-at-io25?ref=zazen_code)**: Chrome 135+ introduces native carousel controls, Interest Invoker API, and AI integration.
* **[Safari 18.4 Enhancements](https://ppc.land/safari-18-4-release-brings-major-web-platform-enhancements/?ref=zazen_code)**: Brings 84 features including declarative push, `shape()`, and Wake Lock.
* **[Safari 26 Preview – WWDC](https://developer.apple.com/videos/play/wwdc2025/233/?ref=zazen_code)**
* **[WWDC25 WebKit Overview](https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/?ref=zazen_code)**

## 📈 Trends & Best Practices

* **[Progressive JSON – Dan Abramov](https://overreacted.io/progressive-json/?ref=zazen_code)**: Suggests streaming JSON breadth-first like progressive JPEGs to boost perceived load speed.
* **[AI + Claude in Web Dev](https://blog.logrocket.com/claude-web-app/?ref=zazen_code)**
* **[Cookie Blocking Detection](https://www.smashingmagazine.com/2025/05/reliably-detecting-third-party-cookie-blocking-2025/?ref=zazen_code)**
* **[Gemini 2.5 and UI Reasoning](https://blog.logrocket.com/gemini-2-5-future-of-ai-reasoning/?ref=zazen_code)**
* **[When to Use PWAs vs Native](https://thenewstack.io/when-to-use-progressive-web-apps-and-when-to-go-native/?ref=zazen_code)**
* **[Deploying Portfolios Simply](https://frontendmasters.com/blog/the-simplest-way-to-deploy/?ref=zazen_code)**
* **[Exploring OKLCH](https://evilmartians.com/chronicles/exploring-the-oklch-ecosystem-and-its-tools?ref=zazen_code)**
* **[Rolldown with Vite](https://voidzero.dev/posts/announcing-rolldown-vite?ref=zazen_code)**
* **[Chrome 137 Release](https://developer.chrome.com/blog/new-in-chrome-137?ref=zazen_code)**
* **[Spotlight Effect in CSS](https://frontendmasters.com/blog/css-spotlight-effect/?ref=zazen_code)**
* **[Better CSS Shapes](https://css-tricks.com/better-css-shapes-using-shape-part-2-more-on-arcs/?ref=zazen_code)**
* **[CSS Reading Order](https://css-tricks.com/what-we-know-so-far-about-css-reading-order/?ref=zazen_code)**

## 🎤 Events

* **[Svelte Summit Spring 2025](https://sveltesummit.com/?ref=zazen_code)** – May 8, Barcelona
* **[Google I/O 2025](https://io.google/2025/?ref=zazen_code)** – May 14–15
* **[WWDC 2025](https://developer.apple.com/wwdc25/?ref=zazen_code)** – June 2–6

## 🎮 Bonus

* **[Interactive 3D Cards](https://tympanus.net/codrops/2025/05/31/building-interactive-3d-cards-in-webflow-with-three-js/?ref=zazen_code)**
* **[35mm Website Breakdown](https://tympanus.net/codrops/2025/05/30/deconstructing-the-35mm-website-a-look-at-the-process-and-technical-details/?ref=zazen_code)**
* **[Animated Product Grid](https://tympanus.net/codrops/2025/05/27/animated-product-grid-preview-with-gsap-clip-path/?ref=zazen_code)**
* **[CSS Minecraft](https://benjaminaster.com/css-minecraft/?ref=zazen_code)**
