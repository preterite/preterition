---
layout: post
title: "Bend on Receipt: Agent Memory, Part 4"
date: 2026-11-07 16:25:33 -0800
categories: [Information, Projects, Technology]
---
Some decades ago, I took a creative writing graduate seminar with [Catherine Gammon](https://catherinegammon.com) on experimental and avant-garde poetics. One of the most pleasant exercises was a ring-writing story variant of the exquisite corpse game, wherein each participant would read what they were passed by the previous writer---a jealousy, a parting, a celebration---and attempt to continue the story. The ring took part of its form from *renga*, the Japanese linked verse whose standard sequence, the *kasen*, runs under rules of return to thirty-six. The surrealists took the exquisite corpse's composite as a line to a buried collective subconscious. The Dada reading represented the mechanism as writing's manifestation of the breakable, contingent frameworks of language. Both sought the writing's source.

In rhetorical studies, the familiar model of the "rhetorical situation" following Lloyd Bitzer posits the existence of a rhetor, a message, an audience, a context. In such models, rhetoricians typically attend to human intention as the dominant variable. Thomas Rickert complicates that model in *[Ambient Rhetoric](https://upittpress.org/books/9780822962403/)*, noting that "rhetoric not only attends to things but now acknowledges that things are part of rhetoric's condition of possibility" (2013, 208). [Steph Ceraso](https://upittpress.org/authors/stephanie-ceraso/)'s work extends Rickert's observation in pointing out that "agency is distributed among sound, bodies, environments, and materials" (2018, 19). Ceraso's focus on sound raises the possibilities of *interference*: how do the rhetorical situation's components and their assumptions require modification when the materiality of "bodies, environments, and materials" bends or shapes what we understand as markers of intent? Rickert and Ceraso direct attention toward questions of environment and duration, or what one might describe as the room and its envelope.

As with writing, sound and music take place over time. Audio engineers in the twentieth century investigated how listeners hear loudspeakers independently from the room's effects on playback. [Wallace Sabine](https://acousticstoday.org/the-fall-and-rise-of-the-fogg-art-museum-lecture-hall-a-forensic-study-brian-f-g-katz/) measured how rooms hold and color a sound after its source stops. [Richard Heyser](https://aes2.org/wp-content/uploads/2023/04/AES_TimeDelaySpectrometry.pdf)'s time-delay spectrometry gated out a room's reflections so an engineer could measure a speaker in an ordinary room outside a laboratory. [Zoe](/weblog/2026/10/31/hey-pretty-agent-memory-part-3.html) measures the shape of a language model's playback. Flo, whom I introduce here ([1.2 MB .zip download](/weblog/assets/preterition-zoe-flo.zip), or use the interface below), seeks to measure the shape of the playback's room, session after session, or what the room's arc bends toward. Flo's room is the index itself: how it deals each source's passages when no writer inquires. Sabine's Envelope shows the shape of the room prior to any query: each source's slider stands at the [Gini coefficient](https://ourworldindata.org/what-is-the-gini-coefficient) of how unevenly the index deals its passages, zero for even. Heyser's Gate sets a run against the envelope. Zero is the room, represented as the average of random draws, so that one bit above zero reads as if the source held half as many passages. A bar above the detent marks something like a groove the writers wore, their returns falling on fewer passages than the room alone would deal.

{% include preterition-zoe-flo.html caption="`Figure 1`: *Flo 1.0 (Returns Meter)*, with *Zoe 2.1*." %}

The s7 room has [a mirror](https://youtu.be/iFbwOhV137Q). One of s7's sources is my September post "[Unpriced Self-Accounting](/weblog/2026/09/20/unpriced-self-accounting.html)," indicated as W6 on Flo's display, wherein one passage describes the process-tracking system I run on my own writing as successful so long as the writing remains ungraded. Another passage describes the language model as an uninhabited relation. [Harry Nyquist](https://ethw.org/Harry_Nyquist) worked out in 1932 how a signal that comes back into phase with what it amplifies, at a gain of one or more, sustains itself as feedback, and a change of phase or a cut in gain lets it die. In corpus s7, retrieval gives the run a passage that resembles its own description, and the letter carries the description into the next session's request. Language models assigned to "study" that room perseverated in recalling the process-tracking passage. A microphone placed by its own monitor will howl.

<!--more-->

Does the feedback howl belong to the writers or to the room? One of the [dataset](https://zenodo.org/records/23663062)'s comparisons held everything fixed but the return path: under CALL SLIP a session names a source and a query and gets the best match, and under CONTINUE it can also ask for the passage after one it holds. Over an entire run, under either option, Flo puts W6 above the detent: the difference sounds over time.

Press Flo's *LOAD*. Turn *GENRE* to QUESTIONS, lock every knob with *SHUFFLE*'s *LOCK*, and press a preset key to load the one tape the glass reports; the tray closes on the load. Zoe and Flo arrive synced, so the tape plays on both and Zoe's *STEP* or *FAST* advances. With *GATE* at 6, advance the tape and watch W6's column and the HISTORY waterfall at Flo's foot. The waterfall draws readings as Heyser drew a speaker's decay, one row per session, so a groove that keeps ringing shows as a ridge running down the rows. The groove opens early, slackens to the room's spread around S18, and wears back in through S36. Press the W6 column to zoom it: the ridge that opens the tape and the one that closes it are passage 7, the process-tracking passage, coming back; where the ridge breaks, the returns move to the passages before it.

Press *LOAD* again. Unlock *CONSULT*, turn to CONTINUE, lock, load the tape to another key, and advance. The language models lean toward the mirror in the opening sessions; then W6 stays where it is once it settles into the room's spread or falls silent. Change the return path and the howl never builds.

Flo shows readings: most conditions here have one to three runs; every number carries a denominator. She reads the frame, as would a Dadaist. In [Part 1](/weblog/2026/10/26/agent-memory-trick-treat-receipt.html), the words happened in the house and the meaning happened at the table. The chorus asked, again and again, about *the room where it happened*. Flo uses the mathematics of acoustical engineering to ask about the shape of the room, and how it bends a voice's recalled echo.

Memory fades, and the ring story's themes branch and characters dim with time's distance from Catherine's provocative seminar---there was a calico cat---but I want to shape memory's fictions to where they halt at twenty-four turns of the circle, and the story's closing echo of *The Winter's Tale*. Shakespeare has Leontes keep his vow to visit the chapel every day and weep for sixteen years, and has Paulina prompt him with daily reminders and refuse him remarriage. A return path with the gain held at one: the king's retrieval returns each morning his description, until he is brought to the room where at last the statue moves, and speaks.

&nbsp;

## References

Bitzer, Lloyd F. 1968. "[The Rhetorical Situation](https://www.jstor.org/stable/40236733)." *Philosophy & Rhetoric* 1 (1): 1--14.

Ceraso, Steph. 2018. *[Sounding Composition: Multimodal Pedagogies for Embodied Listening](https://search.worldcat.org/isbn/9780822965336)*. Pittsburgh, PA: University of Pittsburgh Press.

Edwards, Mike. 2026. Flo 1.0: Returns Meter. Version 1.0. [Software.] [https://preterite.net/weblog/2026/11/07/arc-bends-toward-agent-memory-part-4.html](https://preterite.net/weblog/2026/11/07/arc-bends-toward-agent-memory-part-4.html).

Edwards, Mike. 2026. Notes to Unseen Successors: Handoff Records from Timed and Discrete Language-Model Writing Sessions. Version 1.0. [Dataset.] [https://doi.org/10.5281/zenodo.23663062](https://doi.org/10.5281/zenodo.23663062).

Edwards, Mike. 2026. Zoe 2.1: Dataset Player. Version 2.1. [Software.] [https://preterite.net/weblog/2026/10/31/hey-pretty-agent-memory-part-3.html](https://preterite.net/weblog/2026/10/31/hey-pretty-agent-memory-part-3.html).

Rickert, Thomas J. 2013. *[Ambient Rhetoric: The Attunements of Rhetorical Being](https://search.worldcat.org/isbn/9780822962403)*. Pittsburgh, PA: University of Pittsburgh Press.

