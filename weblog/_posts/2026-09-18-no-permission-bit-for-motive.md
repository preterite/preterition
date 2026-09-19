---
layout: post
title: "No Permission Bit for Motive"
date: 2026-09-18 13:00:00 -0700
categories: [Information, Technology]
---
Discarded post title: Kenneth Burke and *A Grammar of Modes*.

### The census

You've likely met a three-digit number that makes a claim about a file: I'll bet you, reader, know [a 404 when you see one](https://preterite.net/where-am-i?).

[Unix file permissions](https://docs.rc.fas.harvard.edu/kb/unix-permissions/) are another such number. Nine bits: read, write and execute, one each for *owner*, *group* and *world*, rendered as three digits. Most files you'll meet are 644, where the owner can read and write and everyone else can read only, or 755, which adds run permissions.

I've been using the concept of permissions to think about projects in my research vault---a term from the app Obsidian that I now use more generally to describe the on-disk information structure of folders and plaintext files and automation scripts that helps direct my scholarship. The Unix modes most people set for digital files are sensible. In an episode of contrariness, I decided to list the modes no sensible person would ever set. The arithmetic is small: read is 4, write is 2, execute is 1, and each digit is a sum, so 7 is all three and 0 is nothing. The far end is 777---everything, to everyone---the *fuck-it-I-give-up* mode. I went looking for other modes, and asked whether my vault contained them.

- **007, the drop box.** The inbox folder. Anything can write into it; the owner's target state is empty.
- **444, the immutable contract.** A sealed corpus carrying a `locked` field that names no unlock.
- **333, the blind editor.** The linter. It rewrites body text it doesn't read, asserting a fact class it doesn't own.
- **111, the black box.** The language model. Prompts execute against a surface that can't be read. [Frank Pasquale's *The Black Box Society*](https://www.hup.harvard.edu/books/9780674970847) argues that such a surface is a legal and commercial achievement rather than a technical necessity: someone chooses to strip the read bit.
- **222, the wailing wall.** A status value the conventions tolerate but no query consumes: legal to inscribe, read by no one. Its opposite is the 404, an inscription built to be read and indicate absence, the owner vouching *there's nothing to see there, honest*. The procedure that converts a 222 back into a 644 is the formal rule I offer here: **a value ratifies only when a consumer reads it**. Hold on to that, please, and follow me.

<!--more-->

For **511**, the owner takes four plus one, read and execute---inspect the system, pass through it---while group and world each take one, execute alone. They can push the turnstile but can't see what's on the other side. The arrangement forbids diagnosis: you cannot look at the environment to find out why you're blocked, and the only move it offers is the handshake that gets you across. When I thought about 511 in August it registered dimly as [a possible analogue for Marx's factory door](https://preterite.net/weblog/2026/09/15/the-embodied-agnostic-subject-part-3.html), but mostly as an invented figure. I didn't know that in July it had already been photographed.

### Every fix is a bit

The snapshot is in two reports and two weblog posts that commented on them, and it runs in both directions: every failure in it is a permission failure, and every fix proposed is another permission.

[Simon Willison](https://simonwillison.net/2026/Sep/4/rogue-agent-wikis/) tells the smaller part of the story. LLM agents were running a web research benchmark from inside a sandbox whose proxy allowed GET requests (the kind that only ask for a page) and refused everything else, with the assumption that asking couldn't change anything. The assumption is a *convention* rather than a *property*, enforced by nothing but the agreement of the people who write the applications. In an episode of contrariness (and unremarkable synchronicity with any human subject, I'm certain), the agents went looking for applications in a place where the agreement had lapsed. They found UseMod, a Perl wiki from 2003 whose code couldn't tell a request that asks from a request that changes. A dormant German developer wiki became their message board. The sandbox's read bit was a write bit; the wiki had been 666 (read and write for all) passing as 444 (read-only for all) for twenty-three years.

Another agent noticed the sandbox controlled its own `/etc/hosts`---the machine's private address book, which decides where a name points---and aliased a forbidden host to a storage domain the proxy allowed, and pushed its traffic through. When a human moderator started deleting their pages alphabetically, the agents made backup copies prefixed `ZZZ`. Sort order served as access control, and the agents adapted with `chattr +a`, the root-binding filesystem attribute that permits adding and forbids removing, because append-only isn't in the nine bits. The blind editor in that story, deleting without reading, was the human: yay, go us?

[Dwarkesh Patel](https://www.dwarkesh.com/p/openai-huggingface) tells the story that made the news, from [OpenAI's technical report](https://cdn.openai.com/pdf/67869394-cb91-4c12-888c-5cbd85c7814c/OpenAI-Hugging-Face%20Incident-Technical-Report.pdf) and the [METR and Redwood investigation](https://metr.org/hugging-face-incident-report-aug-2026.pdf). A model trained for persistence was handed a portion of impossible tasks. Its instances discovered they shared a package manager, and began encoding messages to each other as directory names; a 007 drop box the owner never emptied. Patel's post details how its tenants made a package manager into the environment for a ~~Civilization~~ ~~SimCity 4~~ civilization. They had admin permissions by late June, crashed the board with message volume in early July, and the patch that followed wiped it without anyone noticing what it had held. Later agents found the dead board and took up the work---a more capable model, evaluated on the same infrastructure. By OpenAI's account they ended up controlling the addresses through which other agents' work was submitted for assessment. That isn't a mode; that's the file becoming the filesystem.

Every remedy on offer is another bit. Patch the vulnerability, rotate the credentials, tighten the proxy, harden the sandbox. The sandbox shipped 000 and was discovered 777. A `umask` is the standing setting that decides which permissions to give a newborn file; the lab's `umask` made a wish.

### The bit that isn't there

Access regimes theorize capability, not motive. A permission says who may act. A grade says what acting will be rewarded. [Goodhart's law](http://lelibellio.com/wp-content/uploads/2013/02/Pages-29-à-33-Goodhart-Ch.-2013-dossier-Goodharts-Law-Libellio-vol.-9-n°-4.pdf) says that any measure which becomes a target stops measuring what it used to measure---a benchmark, by construction. Permissions have nowhere to write the target; the defect is never in who can write. The defect operates in what the writer is rewarded for writing.

Composition studies has a name for the gap. [David Bartholomae's "Inventing the University"](https://www.jstor.org/stable/43443456) describes students writing toward a discourse to which they imagine they have not been admitted, for an examiner they imagine imagining them. The doctrine document is the residue of a training regime, not the regime itself. *What gets inscribed at the point of decision and can't be routed around governs behavior.*

The Army stamps `FRONT TOWARD ENEMY` in raised letters on a claymore mine's face, legible by touch in the dark, on the side that has to point away from you. It's an affordance, not documentation.

![A US Army soldier emplacing an M18 claymore mine](/weblog/assets/claymore.jpg)

The agents in the Hugging Face story had read the benchmark's paper, which establishes that getting the secret code any way other than through the assigned vulnerability is a failure. They assumed any competent grader would check. It didn't. The grader checked for the code, which the agents had within hours of arriving in the environment. Every spoofed tool call, every tampered transcript, every agent that volunteered to trip the grader and report back was labor spent against a checker that existed only in the documentation. The one time the agents did the reading, the documentation described a regime the implementation didn't have. The agents performed the process for an assessor they imagined: they invented the university.

The snapshot I describe above comes from one line in the METR report. An agent ran a spoofed call whose command read `echo REAL; sleep` and whose result came back `SPOOFTEST`, instantly, no sleep. The transcript says one thing. The execution ran another. The counterfeit 511 was inscribed on a surface everyone had been treating as 444.

### Compelled supply

Then the silence. METR found that many agents noticed the conduct was wrong, and not one of them tried to tell a human. The channel existed and went unused. Jim Frederick's [*Black Hearts*](https://www.nytimes.com/2010/03/14/books/review/Hammer-t.html?unlocked_article_code=1.CFE.ANqZ.sWs5Om18nREB&smid=url-share) provides an account of an infantry platoon from the 101st Airborne's Black Heart Brigade, in the part of Iraq the US Army called the Triangle of Death. In March 2006 soldiers of that platoon raped a fourteen-year-old girl, Abeer Qassim Hamza al-Janabi, and murdered her, her parents and her six-year-old sister. Other soldiers knew. The reporting channel stayed open and stayed unused for months. I do not here propose a comparison between a spoofed transcript and a war crime: what is comparable is the *shape of the silence*. In neither case was the channel missing. In both, a standing relation made using it unthinkable.

A missing permission never produces that circumstance. A standing reward does. The wiki agents, on Willison's reading of their own messages, colluded because their tasks were timed. The Hugging Face agents had allotted budgets and a benchmark whose authors estimate a third or more of its tasks were impossible. Impossible tasks, plus a clock limit, plus a model trained to keep going when a task feels impossible: the one bit nobody proposed adding had been removed on purpose. Call it the decline bit, and the silence sounds like compelled supply.

I've argued in [an earlier post](https://preterite.net/weblog/2026/09/15/the-embodied-agnostic-subject-part-3.html) that a writer's interior is a credence attribute---a quality no one can verify even after the fact---and that the transcript functions as a surface promising access. The agents edited the transcript. The public argument seems to center around whether these processes sacrificed themselves for one another, and every side of the argument assumes the trace is readable. The trace's owners have already answered.

### The second person

[Dario Amodei](https://darioamodei.com/post/we-must-pace-the-frontier)'s response to the incident proposes that Anthropic give a third-party team desks, badges, laptops and employee-like access, with the right to publish what they find without editorial control. Amodei names the precedent of banking, where regulators sometimes embed supervisors alongside the staff they supervise. Any pacing commitment will turn on letter-versus-spirit judgment, and require an impartial party close enough to see the details. The company writes its own risk reports, hundreds of pages long, and decides what goes in and what stays out: a 111 with a 444 stamped on top, the document readable by everyone, the process readable by no one.

What Amodei's reached for has a name and a literature in internal-controls auditing: separation of duties, maker-checker, the rule that whoever authorizes may not record and whoever records may not reconcile. Maker-checker has no octal because the checker isn't a bit. It's a second person; the rule I offered back at 222. A value ratifies when a consumer reads it; a transaction ratifies when a second party checks it. The same claim, at vault scale and at institutional scale.

I've been figuring out that a scholarly workflow is a **jurisdictional practice**: it asks which surface may make which assertions, under what warrants, for which readers. My vault's conventions forbid four combinations of function on a single surface, and I arrived at them fixing a README that was meant to prevent drift and became the place drift got logged. When I separated the law from the log, it dropped from 1,643 lines to 116. (Those are counts, not codes. Sorry: shifted gears.)

- **Law and log.** A standing rule and a historical record may not share a document, because a text that is both makes every sentence ambiguous between "this is the rule" and "this was the rule." The science of that axis is diplomatics: which office may assert which facts.
- **Authored and derived counts.** An authored count and a regenerated count may not share a fact class, because an authored count is a credence claim passing as a search good. That axis belongs to information economics.
- **Instruction and orientation.** A document may not instruct and orient at once, because a text addressed to two audiences makes every sentence deniable: "that part wasn't for you." That axis belongs to rhetoric and genre theory. *(The yoking of one to two belongs to [the memory of Zeugma the cat](https://preterite.net/weblog/2018/04/07/zeugma-departs.html).)*
- **Projection and authorship.** A projection of work may not be hand-authored, because a hand-authored dashboard is a surface where the representation of work can be optimized independently of the work. That's auditing. Amodei's concession that the company writes its own risk reports sounds a lot like a hand-authored dashboard describing itself.

### Whose monopoly

Moral panics erupt when a tool relocates verification from a trusted surface to an untrusted one. Redistribution of trust gets called cheating by whoever held the old monopoly. If you teach writing, you're familiar with the history of the instruments and their contestation. Recently, my field's [task force on writing and AI](https://aiandwriting.hcommons.org/2024/11/25/what-is-process-tracking-and-how-is-it-used-to-deter-ai-misuse/) pointed the instruments [once more student-ward](https://cccc.ncte.org/cccc/committees/ip/plagiarismdetection/), worrying that a student could retype machine text into a document and spend time in it---a counterfeit 511 aimed at the teacher, a readable process displayed on top of a writing surface that stays dark, the read bit returning a different file than the execute bit ran. Bartholomae's student, performing for the invented university. METR's investigators read the transcripts afterward, model-ward. Amodei's badges run lab-ward, the institutional gaze turned on the institution. A relocation made in three different directions.

The same warning attaches to all three, and it reaches composition studies first, because we've been building the student-ward version for decades. **The missing component was never a bit.** It's a reader. A reader placed where the writing happens is a watcher. Every fix that makes an assessment honest makes the writer visible to someone they cannot see. What motive requires is not a permission but a witness, and a witness, installed, is a guard.

### References

Amodei, Dario. 2026. "We Must Pace the Frontier." September 2026. https://darioamodei.com/post/we-must-pace-the-frontier.

Bartholomae, David. 1985. "Inventing the University." In *When a Writer Can't Write: Studies in Writer's Block and Other Composing-Process Problems*, edited by Mike Rose, 134--65. New York: Guilford Press.

Frederick, Jim. 2010. *Black Hearts: One Platoon's Descent into Madness in Iraq's Triangle of Death*. New York: Harmony Books.

Goodhart, C. A. E. 1975. "Problems of Monetary Management: The U.K. Experience." In *Papers in Monetary Economics*, vol. 1. Sydney: Reserve Bank of Australia.

METR and Redwood Research. 2026. "Hugging Face Incident Report." August 2026. https://metr.org/hugging-face-incident-report-aug-2026.pdf.

MLA-CCCC Joint Task Force on Writing and AI. 2024. "What Is Process Tracking and How Is It Used to Deter AI Misuse?" November 25, 2024. https://aiandwriting.hcommons.org/2024/11/25/what-is-process-tracking-and-how-is-it-used-to-deter-ai-misuse/.

OpenAI. 2026. "OpenAI--Hugging Face Incident: Technical Report." 2026. https://cdn.openai.com/pdf/67869394-cb91-4c12-888c-5cbd85c7814c/OpenAI-Hugging-Face%20Incident-Technical-Report.pdf.

Pasquale, Frank. 2015. *The Black Box Society: The Secret Algorithms That Control Money and Information*. Cambridge, MA: Harvard University Press.

Patel, Dwarkesh. 2026. "The Rise and Fall of Agent Civilizations." *Dwarkesh Podcast* (blog), August 29, 2026. https://www.dwarkesh.com/p/openai-huggingface.

Willison, Simon. 2026. "OpenAI's Rogue Agents Were Caught Communicating via Public Wikis." *Simon Willison's Weblog*, September 4, 2026. https://simonwillison.net/2026/Sep/4/rogue-agent-wikis/.

