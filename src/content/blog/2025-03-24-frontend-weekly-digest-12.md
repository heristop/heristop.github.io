---
title: "Frontend Development Weekly Digest 🎍 - Week 11-12"
description: Sharing practical tips and the latest trends in JavaScript
pubDate: "2025-03-24"
conclusion: "That's it for this week's frontend digest! What are you most excited about? Happy coding! 🚀"
image: "/images/posts/ferenc-almasi-VPmMy8YA_cU-unsplash.webp"
---

## 🔥 Framework Updates

### Vue.js

- **(👀) [Vue 3.4: `onWatcherCleanup` API](https://javascript.plainenglish.io/vues-watch-revolution-unlocking-powerful-new-features-in-2025-0b15d7fd3ff4?ref=zazen_code)**

  Finally, cleanup logic *inside* watchers. No more forgotten cleanup functions haunting your components at 2am.

- **(🎬) [Motion for Vue](https://motion.dev/blog/introducing-motion-for-vue?ref=zazen_code)**

  Framer Motion has entered the Vue chat. `<motion.div>`, layout transitions, scroll animations — React devs can stop feeling smug now.

- **(💚) [Nuxt 3.16 + Nuxt UI v3](https://nuxt.com/blog/v3-16?ref=zazen_code)**

  `npm create nuxt` is here and Nuxt UI v3 brings Tailwind v4 support. The DX just keeps getting better.

### Next.js

- **(▲) [Next.js 15.2 + Security Patch](https://medium.com/@rs4528090/next-js-15-2-release-whats-new-ed7feb64b88e?ref=zazen_code)**

  New metadata system, error overlays, and React view transitions. Oh, and they patched a critical middleware bypass (CVE-2025-29927). Maybe update before your weekend, yeah?

### Svelte

- **(🧡) [SvelteKit 2.17 + Svelte 5.20](https://svelte.dev/blog/whats-new-in-svelte-march-2025?ref=zazen_code)**

  WebSocket support in SvelteKit and `$props.id()` for SSR-friendly IDs. Svelte keeps making the small things feel effortless.

## 🛠️ Developer Tools & Libraries

- **(🦀) [Oxlint Beta](https://socket.dev/blog/oxlint-now-in-beta-with-500-built-in-rules-2X-faster-javascript-linting?ref=zazen_code)**

  Rust-based linter that's 50–100× faster than ESLint. Your CI pipeline just shed a tear of joy.

- **(📝) [ESLint 9 Flat Config](https://www.neoxs.me/blog/migration-to-eslint-v9?ref=zazen_code)**

  `eslint.config.js` is the new hotness. RIP `.eslintrc`, you were... complicated.

- **(🔬) [Rsdoctor 1.0](https://rsdoctor.dev/blog/release/release-note-1_0?ref=zazen_code)**

  Rspack/Webpack visual analyzer. Finally understand why your bundle is the size of a small country.

- **(🦫) [TypeScript Compiler in Go](https://blog.logrocket.com/typescript-new-compiler?ref=zazen_code)**

  Microsoft rewrote the TypeScript compiler in Go. 10× faster. Your IDE might actually keep up with your typing now.

## 🌐 Web Standards & Browser Updates

- **(🌐) [Chrome Q1 2025 APIs](https://app.daily.dev/posts/new-in-chrome-q1-2025-css-text-box-file-system-access-for-android-baseline-updates-and-more?ref=zazen_code)**

  `text-box`, `node.moveBefore()`, File System Access. Chrome keeps shipping like it's Black Friday.

- **(🎨) [CSS Gap Decorations Proposal](https://blogs.windows.com/msedgedev/2025/03/19/minding-the-gaps-a-new-way-to-draw-separators-in-css?ref=zazen_code)**

  Native gap styling is coming. No more pseudo-element hacks for simple dividers. Finally.

- **(🦊) [Firefox 136](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/136?ref=zazen_code)**

  `:open`, `:has-slotted()`, `Intl.DurationFormat`. Firefox staying relevant one release at a time.

- **(🧭) [Safari 18.3](https://webkit.org/blog/16439/webkit-features-in-safari-18-3?ref=zazen_code)**

  `:has()` and `::view-transition` fixes. Safari fixing bugs? 2025 really is different.

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

---

**Cited Sources:**

- JavaScript Plain English
- Motion.dev
- Nuxt Blog
- Medium
- Svelte Blog
- Socket.dev
- Rsdoctor
- LogRocket
- Daily.dev
- Microsoft Edge Dev Blog
- MDN
- WebKit Blog
- Smashing Magazine
- Clagnut
- Cloud Four
- JSWorld Conference
- Frontrunners
- React Miami
- CityJS London
- Codrops
