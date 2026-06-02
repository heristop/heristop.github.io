---
title: "When Measuring a Code Assistant Ends Up Breaking It"
description: "Token billing for AI coding tools and token-based productivity scores are both textbook Goodhart's law — and 2026 sent the bill, from Microsoft to Anthropic itself."
pubDate: "2026-06-03"
image: "/images/posts/william-warby-WahfNoqbYnM-unsplash.webp"
tags: ["ai", "opinion", "tokens", "goodhart", "developer-productivity"]
conclusion: "Whether the token pays the bill or earns the badge, it's a finger pointing at the moon. The real goal never moved: code that works. The rest is accounting dressed up as virtue."
---

## An old law, a new playground

There's a small law, stated by the economist Charles Goodhart in 1975 and made memorable by the anthropologist Marilyn Strathern in 1997, that fits in a single sentence: **when a measure becomes a target, it ceases to be a good measure.** You pick an indicator because it faithfully stands in for something you actually care about. Then you start chasing the indicator for its own sake. And, quietly, **it begins to lie**.

Half a century later, the AI coding assistant industry has decided to restage the demonstration at full scale. And because it never does things by halves, it offers us two fronts at once: **first by billing for these tools, then by using them to grade the people who use them.** Two chances to step on the same rake. It's almost pedagogy.

## First: what exactly are we selling?

When you ask an assistant like Cursor or Copilot for something, behind the scenes it trades text with a large language model. That text is counted in *tokens* — fragments of words, both going in and coming out. **That's the real unit of cost**, because it's what the model provider charges for.

The trouble is that a token means nothing to anyone. No developer wants to watch a counter spin while they think. So companies long preferred a gentler, more reassuring unit: the *request*. One ask, one request. **"500 requests a month" fits on a pricing grid and scares no one.**

There's the setup. **The token is the thing you actually consume; the request is the approximation you put in front of the customer's eyes.** A convenient proxy — exactly the kind of arrangement Goodhart's law adores.

<div class="img-container">
  <figure class="img-figure">
    <img
      src="/images/posts/ibrahim-rifath-OApHds2yEGQ-unsplash.webp"
      alt="Stacks of gold coins on a white surface"
      class="img-three-quarter img-rounded"
      style="width: 58%;"
    />
    <figcaption class="img-caption">
      The token is the coin that actually changes hands. The request is the price tag you stuck on the shelf.<br />
      <em>Photo: Ibrahim Rifath / Unsplash.</em>
    </figcaption>
  </figure>
</div>

## Front #1: the request that stopped meaning anything

The Cursor case has become the textbook example of the genre. At first, the Pro plan promised a certain number of "fast requests" per month, for a fixed, legible price. A request was a request. Charming.

Except **not all requests are equal** — far from it. A one-line autocomplete and a refactor that crawls an entire repository each count as "one request" on the bill, even though **the second can burn hundreds of times more tokens than the first**. As long as usage stayed tame, the approximation held up. Then came the "agent" models, which read whole projects and produce changes across dozens of files, and the gap turned vertiginous.

So in June 2025, **Cursor switched from counting requests to billing for actual consumption**. To be fair: economically, the decision was defensible. A fixed price per request could no longer cover requests whose cost varied by such proportions. The problem wasn't the idea — **it was the execution**. Users who'd been sold "unlimited usage with rate limits" discovered, reading the fine print, that **"unlimited" actually meant a very finite envelope of credits**. They got surprise overage bills. The company ended up issuing a public apology on July 4, 2025, and refunding part of the charges. The word "unlimited," for its part, kept haunting it for a good while.

<div class="img-container">
  <figure class="img-figure">
    <img
      src="/images/posts/michael-walter-iJMitgqRaZ8-unsplash.webp"
      alt="A long paper receipt on a white surface"
      class="img-three-quarter img-rounded"
      style="width: 32%;"
    />
    <figcaption class="img-caption">
      "Unlimited," it turned out, came with a total at the bottom.<br />
      <em>Photo: Michael Walter / Unsplash.</em>
    </figcaption>
  </figure>
</div>

The moral isn't "Cursor behaved badly." It's that **the proxy snapped**. The request no longer represented the real cost, and the whole edifice built on top of it cracked the day someone pressed a little too hard.

## Why it was rigged from the start: non-linearity

If the proxy gave way, it's because of non-linearity — the same property that makes complex systems unpredictable in general.

In a linear world, two requests would cleanly cost twice as much as one, and you could bill per request and sleep soundly. But here, **the same action can consume ten or a hundred times more tokens than another**, depending on the size of the context sent, the number of round-trips the AI makes with its tools, and the model chosen. A single prompt can ship hundreds of thousands of tokens of context and spit back tens of thousands more.

Direct consequence: **you can't know what "one request" will cost before you've made it.** The link between what the user perceives as a gesture and what that gesture actually costs isn't a straight line — it's a capricious curve. **Any pricing model that assumes the straight line is doomed to blow up one day. The only question is on whom.**

## Front #2: when the token becomes a medal

You might think the story ends there. It's only just starting, because in the meantime someone had a bright idea: **what if we measured engineers' productivity by the number of tokens they consume?**

<div style="display: flex; gap: 1.5rem; align-items: flex-start;">
  <figure class="img-figure" style="flex: 1; min-width: 0;">
    <img
      src="/images/posts/diana-polekhina-Xg-ut7qtJiM-unsplash.webp"
      alt="A measuring tape coiled like a snake on a yellow background"
      class="img-rounded"
      style="width: 100%;"
    />
    <figcaption class="img-caption">
      The measure, coiled like the thing it's about to become.<br />
      <em>Photo: Diana Polekhina / Unsplash.</em>
    </figcaption>
  </figure>
  <figure class="img-figure" style="flex: 1; min-width: 0;">
    <img
      src="/images/posts/praveen-kumar-GrV6d0Vibg-unsplash.webp"
      alt="An Indian cobra reared up with its hood extended in the grass"
      class="img-rounded"
      style="width: 100%;"
    />
    <figcaption class="img-caption">
      Reward the metric, and the metric bites back.<br />
      <em>Photo: Praveen Kumar / Unsplash.</em>
    </figcaption>
  </figure>
</div>

There's an old parable for this. In colonial India, to curb the cobras in Delhi, the British administration reportedly offered a bounty for every dead snake brought in. Clever residents started *breeding* cobras to collect the bounty. When the administration caught on and killed the scheme, the breeders released their now-worthless animals, and **the city ended up with more cobras than it started with**. The anecdote is probably embellished, but it gave its name to the cobra effect: **the moment the reward meant to fix a problem starts feeding it instead**. Reward dead cobras, you get cobra farms. **Reward consumed tokens, and you already know how the story ends.**

The practice even has a name — *tokenmaxxing* — and it spread in a matter of months. According to The Information, a Meta employee built an intranet leaderboard called **"Claudeonomics"** that ranked staff by tokens burned, with badges and honorific titles to win: "Model Connoisseur," "Cache Wizard," the sort of distinctions. The result didn't take long. To climb the ranking, engineers padded their prompts, launched several agents in parallel, and — the savory detail — **left bots looping overnight to inflate the counter without producing a single useful line**.

If that rings a bell, it should. It's the exact rerun of the old **"lines of code" metric** — the one that rewarded the chattiest developer rather than the most effective, and that the industry had supposedly shelved thirty years ago. The technology has changed. **The rake hasn't.**

The pressure doesn't even need a public leaderboard to work. An engineer interviewed by The Pragmatic Engineer described inflating his consumption **not to win, but simply to avoid landing among those who "use too little AI"** — even if it meant asking the model questions whose answers were already in the docs. You're not really cheating. **You're just answering what gets rewarded.** Which is precisely what Goodhart predicted.

## The defense, and why it doesn't save everything

In fairness, not everyone cries trap. **Jensen Huang said he'd worry if an engineer paid \$500,000 didn't consume at least \$250,000 of tokens a year.** The worry, in this case, seems to be about the engineer rather than the budget. Reid Hoffman defends a more measured line: **tracking tokens remains a useful signal for whether your teams are genuinely adopting AI**. And they're not wrong on that narrow point. **An imperfect proxy you *know* to be imperfect can still be an acceptable directional indicator.** May Habib, CEO of Writer, openly grants that her token metric is gameable and that not all tokens create value. She uses it anyway.

**The slide happens when the signal becomes a grade.** As long as "tokens consumed" is used to ask *whether* people are using the tool, it informs. **The day it decides a bonus or a promotion, it becomes a target** — and demotes itself back to noise, "Cache Wizard" badge included.

## 2026: the footnote becomes the headline

While all this was being debated, reality took care of supplying the punchline. Two pieces of news, days apart, in the spring of 2026, close the loop almost indecently.

First, Microsoft. The company had invited thousands of its engineers to use Claude Code in late 2025, and the tool caught on — to the point of eclipsing the in-house Copilot CLI that developers ignored with great diligence. The catch: **token-based billing swallowed the division's annual AI budget in a few months**. Verdict: licenses canceled, forced migration to Copilot CLI by June 30, 2026 — which, by pure coincidence, is the last day of the fiscal year. The official reason cites "toolchain unification." One appreciates the delicacy. **Claude wasn't judged bad; it was judged too expensive because too used** — a very 2026 way of punishing success. And the kicker: these engineers are pushed toward Copilot to escape token billing, even as Copilot itself switches to tokens on June 1. **We're changing the queue, not the cashier.**

Then Anthropic — the model maker itself, the last party you'd imagine caught in its own trap. On paper, prices are dropping: the Opus rate fell by two-thirds in February. But **the bill keeps climbing, because consumption explodes faster than prices recede**. Non-linearity, again. And the subscription tightens notch by notch: a brief removal of Claude Code from the Pro plan in April (reinstated the very next day, just long enough to test the water temperature), then, on May 14, the announcement that **automated usage leaves the plan to join a separate meter, billed at the real price**. The reason given is almost touching in its candor: token demand is climbing faster than supply can follow.

Provisional moral: **the reassuring flat plan masked the real cost, and usage-based billing revealed it all at once** — from the end customer all the way up to the model maker. The sentence from earlier, the one that promised any pricing assuming the straight line would eventually blow up without saying on whom, has just found its answer. On Microsoft, to begin with. And incidentally on Anthropic, which learns that **you can cut yourself with your own knife**.

## The lesson, without the gloss

The data says roughly the same thing as common sense. A study of 22,000 developers finds that AI speeds up throughput — more tasks closed — but that **the number of bugs per developer climbs by more than half in the same motion**. Optimizing consumption doesn't optimize quality. We knew that; it's nice to have the figure.

The remedy, meanwhile, enjoys a suspiciously wide consensus of wisdom. HubSpot's CEO summed it up in a formula — ***"outcome maxxing >> token maxxing"*** — and Salesforce is pushing a framework built on outcomes delivered to the customer rather than tokens torched. Translated into guardrails: **cross several indicators rather than one, keep human judgment alongside the numbers**, and accept that a measure of unpredictability is structural — not a bug some better dashboard will eventually eliminate.

At bottom, whether we're talking about billing the tool or grading the people who use it, it's the same switch: **we turned "help a developer" into a number, and the number promptly went off to live its own life.** The token, whether it pays the bill or earns the badge, remains a finger pointing at the moon. **The real goal hasn't moved: code that works.** The rest is accounting dressed up as virtue.

## Sources 📚

- **Goodhart's law** — Charles Goodhart (1975) and Marilyn Strathern (1997), via [Wikipedia](https://en.wikipedia.org/wiki/Goodhart%27s_law?ref=heristop.github.io) and associated analyses.
- **Cursor** — the June 2025 switch to usage-based billing and the [July 4, 2025 apology](https://cursor.com/blog/june-2025-pricing?ref=heristop.github.io), with timelines from [CloudZero](https://www.cloudzero.com/blog/cursor-ai-pricing/?ref=heristop.github.io), [Vantage](https://www.vantage.sh/blog/cursor-pricing-explained?ref=heristop.github.io), and [Flexprice](https://flexprice.io/blog/cursor-pricing-guide?ref=heristop.github.io).
- **GitHub Copilot** — [The GitHub Blog](https://github.blog/news-insights/company-news/github-copilot-is-moving-to-usage-based-billing/?ref=heristop.github.io) (move to credits computed on tokens).
- **Tokenmaxxing** — The Information, relayed by [Inc.](https://www.inc.com/ben-sherry/what-is-tokenmaxxing-ai-productivity-hack/91328999?ref=heristop.github.io), plus [The Pragmatic Engineer](https://blog.pragmaticengineer.com/the-pulse-tokenmaxxing-as-a-weird-new-trend/?ref=heristop.github.io), [Built In](https://builtin.com/articles/ai-tokenmaxxing?ref=heristop.github.io), and [LeadDev](https://leaddev.com/ai/tokenmaxxing-and-the-search-for-ai-metrics-that-matter?ref=heristop.github.io); figures on 22,000 developers from [Faros AI](https://www.faros.ai/blog/ai-acceleration-whiplash-takeaways?ref=heristop.github.io).
- **Microsoft & Claude Code** — The Verge (Tom Warren), [TechRadar](https://www.techradar.com/pro/microsoft-may-discontinue-claude-code-internally-as-it-looks-to-push-users-towards-github-copilot?ref=heristop.github.io), and [Cybernews](https://cybernews.com/ai-news/microsoft-claude-code-burn-yearly-ai-budget/?ref=heristop.github.io) (license cancellation, June 30, 2026 deadline).
- **Anthropic** — Opus price cut and the [temporary removal of Claude Code from the Pro plan](https://www.xda-developers.com/anthropic-keeps-taking-features-away-from-claude-pro-running-out-of-reasons-to-defend/?ref=heristop.github.io) ([reinstated the next day](https://www.xda-developers.com/anthropic-charging-claude-code-pro-users-extra-opus/?ref=heristop.github.io)), then the [separation of programmatic usage onto a dedicated credit](https://www.digitalapplied.com/blog/anthropic-claude-credit-overhaul-june-15-2026?ref=heristop.github.io) (effective June 15, 2026).
