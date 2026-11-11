---
layout: post
title: "Automating the Null Hypothesis"
date: 2026-11-04 12:44:23 -0800
categories: [Projects, Technology, Writing]
song: "A Corporate Merger -- Estradasphere [680CF603CE55E295]"
---
I'm in the middle of refactoring the HTML and CSS for Zoe's loader drawer to make the loader reusable, because I've realized I'm [gonna need](https://youtu.be/qCzncv0ISaE?t=82) some more instruments. A reusable loader means one less component to adapt, but the scripts and smoke tests are taking a while to run in the [Playwright](https://playwright.dev/docs/intro) harness.

So while the scripts and tests run, here's the deal: the reason I'm building these instruments for running and comparing batch tests on machine writing. My argumentative point behind [Zoe 2.1](/weblog/2026/10/31/hey-pretty-agent-memory-part-3.html) as a tool for reading data, and behind [Robinson's Zoetrope](/weblog/2026/10/29/dataset-playback-agent-memory-part-2.html) as an instrument, and behind [Cohle's Pinwheel](/weblog/assets/cycle-figure.svg) as their originating metaphor, is a point about time.

Writing and reading are processes that take place over time. They have value. That value changes and gets [appropriated](/weblog/2026/10/04/appropriation-position-and-relation.html) over time, as well. Writing studies today takes the organization of writing's work over time---the writing process---as one of its fundamental organizing insights. 

<!--more-->

A language model is **stateless**: it carries its training into every session and no record of the session before. A session retains a matter only by inscribing it where the next session can retrieve it. Zoe measures that inscription: what the letter holds, the form the letter takes, and any prohibition it carries or drops. Writing, for machines, is a set of momentary calculations: a model reads its entire input at once[^1] and writes one word at a time, and the call ends with no record kept.

There's a measurement disjuncture between human writing and machine writing. Human reading and writing get measured in diachrony, across the time the writing process names. The machine's call gets measured in synchrony, at the one moment it holds its input. The instruments I'm developing assign the machine's vocabulary its own measures, in order to avoid measuring machine phenomena in human terms or vice versa. Zoe's siblings---including the one I'm testing now as I wait for the scripts to finish---suggest a possible approach to subtracting context from the shape of what the messages pass forward. 

My goal in building these instruments is to isolate the variables that contribute to machine writing. Strip those variables away, and the machine's share remains as the training it carries into every session. Language models can be used as instruments to carry testable null hypotheses for writing studies.

&nbsp;

[^1]: A transformer treats its input as a set: each word's place in the sequence must be marked in the word itself. The transformer's original design tagged each position with the sines and cosines of Fourier analysis, like clock hands turning at different speeds to wrap the line of the sequence around the perimeter of the clock's face. Most current models instead rotate each word's vector by an angle that grows with its position, in what's called rotary positional embedding, so that two words compare by the angle between them. The order of the sequence, as the model's version of time, becomes an arrangement in space. These instruments help measure what the spatialization of time does to writing.
