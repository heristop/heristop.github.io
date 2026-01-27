---
title: "When Two Frauds Make a Truth"
description: "When human curation and algorithmic selection both claim to create poetry, who's the real author?"
pubDate: "2026-01-27"
conclusion: "Perhaps poetry was never in the words themselves, but in the space between text and reader."
image: "/images/posts/2026-01-27-when-two-frauds-make-a-truth/article-header.webp"
---

**TL;DR:** I built an algorithm that finds accidental haikus in old books. Some of them are weirdly good. This made me question who the real author is — the code, the original writer, or the reader.

> 📖 [Read the full article on GutenKu](https://gutenku.xyz/blog/gutenku-when-two-frauds-make-a-truth)

## The Discovery

I found Dimitri Rataud's *Haïku Marinière* — he blacks out pages from old books, keeps a few words, calls it poetry.

My reaction: isn't this just cherry-picking with extra steps?

## The Algorithmic Mirror

That question bugged me enough to build **GutenKu** in 2023. I wrote code that scans 70,000+ Project Gutenberg books looking for word sequences that fit the 5-7-5 pattern. No writing. No intent. Just extraction.

If Rataud's a fraud because he didn't write the words, GutenKu is worse — it doesn't even know what it's selecting.

And yet. Some of these found haikus hit hard. They work. I didn't expect that.

## The Reader as Author

Barthes argued that meaning comes from readers, not writers. If code produces words with no intention and people still find something in them — maybe poetry was never about the writing at all.

Maybe it's about the reading. We decide to find meaning. The text is just raw material.

A few questions:

- If a poem moves you, does it matter how it was made?
- Does AI write, or do we project meaning onto noise?
- What's the real difference between human curation and algorithmic selection?

---

## GutenGuess: The Game

I also made **GutenGuess** — you see a haiku, guess which book it came from. Six tries. Daily puzzle.

🔗 [gutenku.xyz/game](https://gutenku.xyz/game)

## Under the Hood

No LLMs. Genetic algorithms, NLP scoring, neural networks. Code is open source.

🔗 [Technical deep dive](https://gutenku.xyz/blog/gutenku-technical-deep-dive)
