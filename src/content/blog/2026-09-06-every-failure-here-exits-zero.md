---
title: "Every Failure Here Exits Zero"
description: "Rewriting a twenty-year-old point-of-sale system in weeks, with agents writing most of the code. Every merge request now carries a before/after video, because six diffs a day is more than I can honestly read. Building that video taught me something about failures that succeed."
image: "/images/posts/2026-09-06-every-failure-here-exits-zero/before-after-banner.webp"
pubDate: "2026-09-06"
tags: ["playwright", "ffmpeg", "ai-agents", "mcp", "case-study"]
conclusion: "A verification artefact that can fail silently is worse than no artefact at all, because it gets trusted. Every check in this pipeline was written after the matching failure had already shipped."
---

## The premise

I am rewriting a point-of-sale system, the software behind supermarket tills: scanning, promotions, payment, receipts, and the fiscal rules that come with all three. The version being replaced has been accumulating behaviour for the better part of twenty years, in C with an ageing front end on top, and the new one is supposed to do the same job after a few weeks of work rather than two decades of it. That schedule only holds because agents write most of the code, which is also where my problem starts.

Five or six stories are in flight at any given moment. Each lands as a merge request with a diff long enough that reading it properly costs twenty minutes I have not got, so what happens is the obvious thing: I approve something I did not really read, and I tell myself I did.

Every merge request now carries a video instead. The ticket, what changed, the screens before and after, in under a minute.

It is a selfish artefact. Watching the flow run is the only review I trust to catch the case where what shipped is not what the ticket asked for, and it fits in the gap between two meetings. QA gets the benefit second: they pick up the ticket with the video already on it and know what to test without coming to ask me.

The pipeline behind it is dull on purpose. The agent reads the ticket straight out of Jira so nobody retypes the story, writes the tests, writes the code, runs the build, then starts the app and plays the flow through a browser while filming the screens it touched. Those recordings go to **[LeClap](https://leclap.dev)**, which cuts them into a clip and posts it to the merge request and to the ticket. One point I was stubborn about: the editor renders rather than generates, so the same description always produces the same images. I did not want a guardrail capable of inventing something the diff does not contain.

What follows is everything between the recording and the finished clip, which is where the time actually went.

## What the clip actually is

Six sections: a title card, then a BEFORE card and its clip, an AFTER card and its clip, then an outro.

<div class="img-container">
  <figure class="img-figure" style="width: 100%; max-width: 48rem;">
    <video controls loop playsinline preload="metadata"
      poster="/images/posts/2026-09-06-every-failure-here-exits-zero/title-card.webp"
      style="width: 100%; border-radius: 0.5rem; border: 2px solid var(--border-image);">
      <source src="/videos/2026-09-06-every-failure-here-exits-zero/spos3-1965-evidence.mp4" type="video/mp4" />
      Your browser does not support the video tag.
    </video>
    <figcaption class="img-caption">
      A real clip, posted on a real merge request, unedited. Twenty-two seconds, on a ticket about a payment-transfer action that stayed greyed out when it should have opened. The length follows the flow being tested, not a budget.
    </figcaption>
  </figure>
</div>

The card-then-clip pair is written once and reused twice, once per side, which is how six sections come out of two lines of description. Each reuse glues a word onto the front of the names, so the pair becomes `beforecard` and `beforeclip`, then `aftercard` and `afterclip`. Those names are not decorative, they are addresses: the section called `beforeclip` looks for a file called `beforeclip.mp4` and for nothing else, and no setting anywhere lets you say *for this section, use that file*. The only way to point at a recording is to give it the name of the section that wants it.

Misname one and the whole render stops on `✗ Compilation failed to produce output`, which is also what you get for a bad duration, and for an effect the engine does not support. Terse, but at least it stops.

It is the last time in this article that anything does.

## The agent does not open a terminal

It talks to the video editor over MCP, which is what people usually mean when they say an agent "uses a tool". In practice it can ask three questions and give one order: what fields does a description actually accept, how long is this recording and what size, and **do a dry run and tell me which files you are about to look for**. Then render.

The dry run is the one that earns its place, for the reason above. Names are addresses here, so having them read back to you before anything renders beats any error message you get afterwards.

One decision inside that setup generalises past this project. The editor runs from a copy of the code linked on my machine, rather than being fetched from the package registry on demand. Fetching on demand is convenient and not free: the first call quietly builds a throwaway install off to one side and keeps it in a cache, and mine is currently sitting on 26 of those, a gigabyte and a half. For a command you run three times per video that is a fine deal. For a tool the agent connects to it is not, because the connection is made at the start of every session rather than once per video, so you pay all day instead of per clip and you silently get whichever version was published last. You find out when a render changes shape under you.

The rest of it is configuration I got wrong twice, and it now lives in the skill rather than in my head, which is the subject of the last section.

## The recording lies about time

My first attempt at trimming counted backwards from the end. The interesting click happens two seconds before the test finishes, so cut the last five seconds and you have it.

I did not have it.

A browser recording is not aligned to the clock. A test that took 15.3 seconds produced a 13.9 second file, because the recorder drops frames when the machine is busy, and what lands on disk is shorter than what happened by an amount that changes with the machine. An offset measured against the test's own duration therefore lands somewhere else in the video, and somewhere different on the build server than on my laptop. Nothing fails; you get a clip of the app sitting still, which is indistinguishable from a clip of a feature that does nothing.

Comparing frames to each other and cutting around the moment the screen changes is slower to write and works. And trim harder than feels polite while you are there: there are always several seconds of blank startup at the front, and a reviewer watching a progress spinner is a reviewer not watching the change.

## The crop eats the two rows that matter

A till screen is 1024×768, nearly square. Video is 1280×720, not square at all. Something has to give, and the engine's default is to fill the frame and throw away the overflow at the top and the bottom, which on a till is the header and the footer, which is where the total, the payment state and the operator's name live. The change under review was in the footer more than once.

So the picture gets padded sideways before the engine ever sees it. Whether anyone notices depends on the layout: on a clip that fills the frame the padding shows as two plain bands, and on one framed beside a caption panel, like the video above, it disappears under the composition.

```bash
ffmpeg -i raw.webm -vf "scale=960:720,pad=1280:720:160:0:black" -r 30 beforeclip.mp4
```

## An apostrophe cannot go through

Every card and caption is drawn by FFmpeg, and half of the copy is French: `l'écran`, `d'origine`, `n'existe`.

The apostrophe does not need escaping. It cannot be passed at all. I tried the three ways you would try, all three finished successfully, and all three rendered *iso V2's reason popup* as *V2s*, dropping the character without a word.

One of them goes further. It eats the instruction that follows it, which happens to be the one naming the font, and the rest of that instruction ends up painted across the frame as literal text. That is how a card reading `…reason popup:fontfile=build/fonts/Ubuntu-Regular.ttf:…` got rendered, uploaded, and attached to a merge request. The only warning anywhere was a single line of noise in the log, and it was there because losing the quote had taken the font down with it.

Handing the text over in a file instead of on the command line works. It brings two smaller problems of its own, of the encoding and path-syntax variety, which are the sort of thing you fix once and then write down somewhere you will look.

## A missing font does not fail either

The obvious FFmpeg to install on a Mac cannot draw text at all, which at least announces itself: every card dies immediately, and you go and install a build that can.

Then there is the quiet version. A font file that does not exist does not fail. The renderer substitutes a wide default sans, finishes happily, and hands you a clip in the wrong typeface with one stray line in the log as its only tell. A mix-up between two fonts went all the way through on that, and I only caught it because two videos from the same series happened to be open in adjacent tabs and one of them was visibly fatter than the other.

## Text never wraps, and nothing tells you

There is no line wrapping. A description longer than its box runs straight out of it and over the footage, and neither the render nor the validator says anything about it. An overflowing panel has already shipped this way.

Writing copy short enough to fit is not a fix, it is a bet on the next ticket's title being short too. Counting characters does not work either, since letters are not the same width: thirty characters of `SUSPENSION` and thirty of `Suspension` differ by a third. The text is measured properly now, letter by letter against the width of the box, and a label that does not fit raises an error rather than being rendered off the edge.

The badge ended up with a two-word vocabulary, `BEFORE` or `AFTER`, with the finding moved into the title beside it, because it is the one element with nowhere to wrap to. What settled that was a measurement: `THREE RUBRICS` came to 201 pixels against a budget of 218. It fitted, at 92 % of the space available, and one longer word would have put it outside the frame.

## Reproducible, but only just

The claim I make about this pipeline is that the same description and the same recordings give the same video, which turns out to be true with an asterisk I only found because I went looking. Rendered on two different builds of FFmpeg, the files are not identical. Not visibly different, and the picture is the same to any measurement I know how to make, but the compression underneath is not the same. The description pins everything it can reach and it cannot pin the encoder.

Reproducible therefore means *for a given FFmpeg*. A re-run in six months gives back the same picture, and gives back the same file only on the same machine, which in practice means settling on one FFmpeg for a batch of merge requests so that at least the clips match each other.

## What the guardrail needed

A shortened recording, a cropped header, a dropped apostrophe, a substituted font, an overflowing label, a differing encode. Not one of them returns an error. Every one produces a finished, playable, entirely plausible video that is wrong in a way you only catch by watching it closely, which is the work the video was supposed to save me.

This goes well past video. **A verification artefact that can fail silently is worse than no artefact at all, because it gets trusted.** An empty merge request description makes a reviewer read the diff. A convincing clip of the wrong screen makes them approve.

So the pipeline checks what it used to assume. Fonts are verified rather than passed. Labels are measured against their box and refuse to render if they overflow. Trims anchor on what changed on screen instead of on the clock. The template gets a dry run before every render. None of it is clever, and all of it was written after the matching failure had already shipped.

Which is why the checks are not really the deliverable. The file they are written down in is: a skill, a document the agent reads before it makes one of these videos, holding the house template, the colour convention, and a long section called *the traps* whose entries are, one for one, the failures above. Without it the agent rediscovers the apostrophe on every ticket, and it has no way to know that the FFmpeg on the path cannot draw text.

It runs to 362 lines. Most of it is a list of ways to be wrong that produce a working video.

---

The renderer is on npm as `ffmpeg-video-composer`, with a command line and an MCP server alongside it. All of it is MIT: [github.com/heristop/leclap](https://github.com/heristop/leclap).
