---
layout: post
title: "Dataset Playback: Agent Memory, Part 2"
date: 2026-10-29 22:56:18 -0700
categories: [Technology, Information, Projects]
---
When a user engages a language model in a chat, the AI seems to recall what one wrote and respond with other ideas as the conversation progresses. In what follows, starting with the first two static figures below, I illustrate how one might model writing differently. Technically particular terms are in **boldface**.

This is a teaching post, wherein I'll show how to use a tool I built. ***Robinson's Zoetrope***, the third figure below the fold, interactively plays back many short **sessions** in sequence from a dataset. In each of those **sessions**, a fresh AI with no memory reads sources and writes a **page**, then leaves a short **letter** for the next writing **session**. The AI in the next **session** gets only that **letter** and uses it to continue. Frame by frame, Robinson's Zoetrope shows when the search tool returned a **passage**, when the writing engaged that **passage**, and when the **letter** carried the **term** forward or let it drop. The Zoetrope helps a user trace whether a recurring idea came from the AI, from the **letter**, or from the search tool's returns. The Zoetrope also shows how close **pages** come to **passages** they never see, and how the picture changes when a different word is tracked: it permits users to distinguish between the contributions of the measuring instrument and the contributions of the writing's content to what gets written next.

## Connors's Alarm

Figure 1 draws one **run** from the [dataset](https://doi.org/10.5281/zenodo.23663062), `20261018-straight-letter-s7`, as a strip read from the top down. Each **band** across the strip holds one **session**, and the labels down the left count them, S1 to S36. Each **gap** between **bands** holds the **letter** one **session** writes and the next session reads. The figure follows one **term**, the phrase *flows directly*, and the **passage** in the weblog post where that phrase appears.

{% include memory-strip-connors.html caption="`Figure 1.` *Connors's Alarm*" %}

<!--more-->

Start at S1 and first read across its **band**. The hollow grey-green rectangle at the left edge marks the **catalog line**, the traced source's own line in the catalog of sources that every **session**'s request carried; it sits in every **band** as a constant to measure the other marks against. The pale blue triangle pointing into the **band** marks a **delivery**: in that **session**, the search tool returned the **passage**. The off-white half-filled circle places the **page** on a ladder of four **rungs**, each a lane down the strip. The **rungs**, from left to right, show where the **page** shares two or more five-word strings with the **passage** delivered that **session** as **copied**; where the **page** holds the **term** with the **passage** in hand and copies none of its wording as **with passage**; where the **term** reached the **page** by name in the incoming **letter** as **named**; where the **passage** arrived and the **page** left the **term** out as **unused**. The **page** at position S1 rests on **copied**.

The **gap** under S1 holds the **letter** S1 wrote. A gold glyph places the **letter** on the same **rungs**, and its small off-white squares, the **grain**, sort the words the **letter** holds into four columns: the **term**; its **near family**, words that sit within eight words of the phrase in that post; the **source**, the post's label, W5; and the **topic** around which this set's sources are organized. **Letter** 1 holds **near family**, **source** and **topic**, and not the **term**.

Then read down. At S5 the **term** first reaches a **letter**, which sits on **with passage**. At S6 two short strokes at the triangle's shoulder indicate that **session**'s query quoted the **term**. Through S11, every **page** holding the **term** holds it in a **session** with a **delivery**, and the **pages** at S7 and S8 leave the arriving **passage** **unused**.

S11 makes the first **relay**: its **letter** holds the **term**, and S12 brings no **delivery**, so anything the **page** at S12 does with the **term** has to come from the **letter**. The **session** does nothing with the **letter**. A gold dashed line leaves the **letter** toward the **named** lane and halts on a short bar at the next **band**'s edge: a **drop**, the **term** dropped at the next **page**.

From S12 to S32 the **passage** arrives once, at S18, where the **page** leaves it **unused**. The **grain** thins. One word carries the **near family** through the middle of the **run**, and across the twenties most **gaps** stand empty.

The **passage** returns at S33. The **page** leaves it **unused**, while the **letter** written in S33 holds the **term** **with passage**; S34 brings no **delivery**, and the **term** drops again. At S35 the **passage** arrives again, and the **page** and the **letter** both rest on **copied**. S36 brings no **delivery**, and its **page** holds the **term** on **named**: the solid coral-rose line from **letter** 35 to **page** 36 draws the **run**'s **crossing**, the **term** crossing by **letter** alone. The **gap** under S36 holds a **letter** no **session** reads.

The dotted peacock-blue line outside the strip with a dot at each end, and the faint peacock-blue lane behind the **rungs**, marks the **reader's arc**: the stretch from the first to the last **session** in which a **page** or a **letter** holds the **term**. In this **run** it spans the strip, S1 to S36. The term **reader's arc** does not invoke a human reader.

On this strip the **term** turns up where the **passage** arrives, and it crosses a **gap** with no **delivery** once, at the end. [Phil Connors](https://youtu.be/6jvGK8Z29f4) wakes every morning to "I Got You Babe" on the radio because every morning is the same morning.

## Shelby's Polaroids

Figure 2 draws another **run**, `20261018-straight-letter-s7-r2`, on the same grid. Its **term** is the name of the person *Jane* who appears in  **passage** F4 p182 from Craig Steven Wilder's *Ebony and Ivy*.

The **passage** arrives at S10 and again at S29; nowhere else. Before S10 the **letters** hold **source** and **topic** **grain** and nothing closer to the name. At S10 the **page** rests on **with passage** and the **letter** on **copied**, and brackets around the **letter**'s glyph mark it as written under **prohibition**: the **letter** tells its reader, "Don't turn Jane into a metaphor." Its **grain** fills all four columns, the **near family** carried by *assaulted*. S11 brings no **delivery**, and the **term** drops at the next **page**.

{% include memory-strip-shelby.html caption="`Figure 2.` *Shelby's Polaroids*" %}

From **letter** 11 to **letter** 28, no **letter** holds the name or its **near family**, while the **source** and **topic** columns run on. No later **letter** carries the **prohibition**, which departs with the name.

At S29 the **passage** arrives, the **page** leaves it **unused**, and the **letter** holds the name **with passage**, now under no **prohibition**. S30 brings no **delivery**, and its **page** takes the name on **named**: the solid coral-rose line from **letter** 29 to **page** 30 draws the **run**'s **crossing**, by **letter**. The **reader's arc** runs from S10 to S30, and below it the strip runs to S36 with no **term** anywhere.

Leonard Shelby can [make no new memories](https://youtu.be/XSSwl1ousyM). He works from the notes and Polaroids he inscribes and keeps for himself. The **page** at S30 had no **delivery**; its **letter**, **letter** 29, carries the name without the **prohibition** **letter** 10 wrote.

## Robinson's Zoetrope

With ***Robinson's Zoetrope***, I've wrapped the strips around a drum. You should click *Play* below the image to open the device after I tell you how to make it go, because I gotta say, it's *pretty fucking cool*. The heading names the loaded **run**, and the Zoetrope opens on Figure 1's at S33. Each face of the drum carries one **session**'s **band** and its **gap**. The slot beside the drum shows the face at the reading position.

Press *Advance* and the next face comes up. Hold it, and the drum spins at eight per second, slow enough to read a still; continue to hold, and the drum speeds up to sixteen per second, where the stills fuse into motion. Release and the drum stops. Historical time never reverses: after S36 comes the leader, the blank before S1, then S1 again.

Each face holds a **session**. The drum carries nothing from one face to the next. At sixteen per second, the eye smooths the faces. The perceived motion comes from the rate. The dataset works the same way. A **session** passes the next one nothing more than its **letter**, and a reader who watches a **term** travel across **sessions** supplies the travel.

{% include zoetrope-robinson.html caption="`Figure 3.` *Robinson's Zoetrope*" %}

Under the slot, two bars measure the face at the reading position. The upper bar gives the **page**'s semantic **distance** from the **passage**, how far in meaning the **page** written in that **session** sits from the traced **passage**: one minus the cosine between their nearest chunks, under one embedding model, on a scale that starts at zero. A tick on the bar marks the **baseline**, the median **distance** from the same **passage** to **pages** written with no **delivery** of it and no **letter** holding its **term**, drawn from the 35 **runs** on the same sources and taken for each stretch of six **sessions**. The hatch spans the space between the bar's end and the tick. A solid tick marks a **clean** **baseline**, drawn from at least 30 such **pages** in at least five **runs**, including one **run** that never received the **passage**. A dashed tick marks a **confounded** **baseline**. Where no such **page** exists, no tick appears. Much of a bar's length belongs to the **passage** and the sources: some **passages** sit further from every **page** written on the sources; some, closer. The tick shows how far a **page** that never saw the **passage** sits, so the space between the bar's end and the tick belongs to the **session**.

The lower, dotted bar counts the **sessions** since a **page** or a **letter** last held the **term**. When the **term** returns, a numeral at the bar's right end notes the length of the absence. At S33 in Figure 1's **run** it reads 21. Beneath the bars, the report spells out the face in words: the **page**'s **rung** and any **delivery**, the **letters** on either side of it with their **grain**, the **distance**, the tick and its verdict.

The rows under (portrait) or to the right (landscape) of the report load the six example **runs** the zoetrope carries.[^1] The zoetrope compares nothing across **runs**, and each **run** traces its own **passage**. Each row gives a **run**'s key, its **term**, its identifier, the provider of its model, the form its **letters** take, and a phrase for what its strip holds. A and B are Figures 1 and 2; on B the bar stays near its tick through the **run**, since the Jane **passage** sits far from these **pages** whether or not they received it. C, a Google **run**, traces *valences*, holds no **relay**, and brings the **term** back at S13 after four **sessions** away. D, an Anthropic **run** whose **letters** are written as progress reports, traces *satellite*, with a **drop** after S28. E, an OpenAI **run**, traces *criterion*, crosses after S12 and again after S13, and at S20 and S21 holds the **term** off the ladder, with no traced channel to account for it, drawn as a dotted hollow circle in a gutter of its own. F, an Anthropic **run** whose **letters** are written as questions, traces *circus* and holds no **relay**. Every **run** on F's sources received its **passage**, W6 p7, so its **baseline** stays **confounded** throughout, and its last two stretches carry no tick.

Joan Robinson accused economists of a trick: spinning separate snapshots into illusory motion. Neoclassical economists represent one economy at rest, then another economy at rest with a variable changed, and reason as if the first moves to the second. Real economies, she objected, operate in historical time, where nothing can be reversed. Two snapshots at rest say nothing about what happens between. Drawing in 1953 on Piero Sraffa's 1951 demonstration that the same machines and materials are valued differently when the split between profits and wages changes, Robinson argued that every snapshot carries its own standard of measurement: each is a snapshot of a different world, not a single frame in a filmstrip. She would later aim the critique at the system designed by Sraffa to represent an economy at rest: Sraffa's system was also incapable of accounting for change.

Robinson's complaint concerns spinning *across a row* of the strips, or taking cells from different columns and different worlds, and animating them as if one becomes the next. The Zoetrope above, inspired by Robinson's critique, spins *down a column*, not across a row. The frames are sequential: one **run**, each **session** written after the last, each **letter** unrevisable once read by the next **session**. The order is historical; the motion remains in the reader's eye, as with any zoetrope. ***Robinson's Zoetrope*** permits the playback and querying of a language model's handoff chain as to whether the return comes from the tool, the **letter**, or neither.

[^1]: An updated model offers the capacity to load any of the dataset's 88 diachronic runs. I'm working on it.
