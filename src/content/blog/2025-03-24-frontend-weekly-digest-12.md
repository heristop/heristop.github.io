---
title: "Frontend Development Weekly Digest 🎍 - Week 11-12"
description: Sharing practical tips and the latest trends in JavaScript
pubDate: "2025-03-24"
conclusion: "💡 Stay updated with the latest in frontend development. Follow the links for more insights."
image: "/images/posts/ferenc-almasi-VPmMy8YA_cU-unsplash.jpg"
---

## 🔥 Framework Updates

### Vue.js

- **Vue 3.4: `onWatcherCleanup` API:** Vue 3.4 introduces `onWatcherCleanup`, enabling internal cleanup logic directly inside watchers. This streamlines lifecycle handling in reactive components. [Read more](https://javascript.plainenglish.io/vues-watch-revolution-unlocking-powerful-new-features-in-2025-0b15d7fd3ff4?ref=zazen_code)

- **Motion for Vue:** Framer Motion arrives in the Vue ecosystem with `<motion.div>`, layout transitions, and scroll animations. Same API, same power — now in Vue.  [Read more](https://motion.dev/blog/introducing-motion-for-vue?ref=zazen_code)

- **Nuxt 3.16 + Nuxt UI v3:** Nuxt 3.16 introduces `npm create nuxt`, while Nuxt UI v3 brings full Tailwind v4 support, improved accessibility, and a modern design refresh. [Nuxt 3.16 Release](https://nuxt.com/blog/v3-16?ref=zazen_code) | [Nuxt UI v3](https://nuxt.com/blog/nuxt-ui-v3?ref=zazen_code)

### Next.js

- **Next.js 15.2 + Security Patch:** New metadata system, enhanced error overlays, and support for React view transitions. Also patched a critical middleware bypass vulnerability (CVE-2025-29927). [What’s New](https://medium.com/@rs4528090/next-js-15-2-release-whats-new-ed7feb64b88e?ref=zazen_code) | [Security Patch](https://nextjs.org/blog/cve-2025-29927?ref=zazen_code)

### Svelte

- **SvelteKit 2.17 + Svelte 5.20:** WebSocket support in SvelteKit and new `$props.id()` utility in Svelte 5.20 for SSR-friendly IDs. [What’s New](https://svelte.dev/blog/whats-new-in-svelte-march-2025?ref=zazen_code)

## 🛠️ Developer Tools & Libraries

- **Oxlint (Beta):** Rust-based linter (50–100× faster than ESLint). [Read more](https://socket.dev/blog/oxlint-now-in-beta-with-500-built-in-rules-2X-faster-javascript-linting?ref=zazen_code)

- **ESLint 9 Flat Config:** ESLint 9 moves to `eslint.config.js`. [Migration guide](https://www.neoxs.me/blog/migration-to-eslint-v9?ref=zazen_code)

- **Rsdoctor 1.0:** Rspack/Webpack visual analyzer. [Release notes](https://rsdoctor.dev/blog/release/release-note-1_0?ref=zazen_code)

- **TypeScript in Go:** New Go-based compiler. [Announcement](https://blog.logrocket.com/typescript-new-compiler?ref=zazen_code)

## 🌐 Web Standards & Browser Updates

- **Chrome Q1 2025 APIs:** `text-box`, `node.moveBefore()`, File System Access. [Details](https://app.daily.dev/posts/new-in-chrome-q1-2025-css-text-box-file-system-access-for-android-baseline-updates-and-more?ref=zazen_code)

- **CSS Gap Decorations Proposal:** Native gap styling proposal. [Proposal](https://blogs.windows.com/msedgedev/2025/03/19/minding-the-gaps-a-new-way-to-draw-separators-in-css?ref=zazen_code)

- **Firefox 136:** `:open`, `:has-slotted()`, `Intl.DurationFormat`. [Release notes](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/136?ref=zazen_code)

- **Safari 18.3:** Fixes for `:has()`, `::view-transition`. [WebKit blog](https://webkit.org/blog/16439/webkit-features-in-safari-18-3?ref=zazen_code)

## 📈 Trends & Best Practices

- **Web Components vs Frameworks:** [Smashing Article](https://www.smashingmagazine.com/2025/03/web-components-vs-framework-components?ref=zazen_code)

- **Performance Mistakes in Next.js:** [Read more](https://javascript.plainenglish.io/10-performance-killing-mistakes-i-made-in-my-next-js-app-99d890607746?ref=zazen_code)

- **Fluid Typography Debate:** [Rutter’s take](https://clagnut.com/blog/2441?ref=zazen_code)

- **Utility CSS Patterns:** [Cloud Four blog](https://cloudfour.com/thinks/cowardly-defaults-and-courageous-overrides-with-modern-css?ref=zazen_code)

## 🎤 Events

- [JSWorld Conference 2025](https://jsworldconference.com?ref=zazen_code)
- [Frontrunners 2025](https://frontrunners.tech?ref=zazen_code)
- [React Miami](https://www.reactmiami.com?ref=zazen_code) | [CityJS London](https://london.cityjsconf.org?ref=zazen_code)

## 🎮 Bonus

- **StringTune Framework:** [Codrops demo](https://tympanus.net/codrops/2025/03/19/stringtune-the-javascript-library-born-from-a-design-agencys-workflow?ref=zazen_code)

- **Interactive Grid with Three.js:** [Demo](https://tympanus.net/codrops/2025/03/18/building-an-interactive-image-grid-with-three-js?ref=zazen_code)
  [Tutorial](https://tympanus.net/codrops/2025/03/18/building-an-interactive-image-grid-with-three-js?ref=zazen_code)

### 💻 CSS for Dummies

_Sass-flation:_

```css
.egg-carton {
  eggs: 12;
  price: $2;

  &.eggflation {
    eggs: 4;
    price: $10;
    wallet: null;
    opacity: 0.4;
    justify-content: space-around;

    &:hover {
      cursor: not-allowed;
      content: "Maybe next month...";
    }
  }
}
```
