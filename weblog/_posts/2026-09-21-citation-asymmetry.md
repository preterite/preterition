---
layout: post
title: "Citation Asymmetry"
date: 2026-09-21 19:13:18 -0700
categories: [Academia, Technology]
---
I sometimes find myself slightly irritated by rhetoric and composition's canonizing of James Berlin's dismissal of cognitive psychology's contributions to the field. I wonder whether Berlin might be embarrassed today to see how silly his dismissal was, and how much the foundational principles he hand-waved away underpin contemporary understandings of language use and meaning-making. I've previously [observed and critiqued](https://doi.org/10.1080/07350198.2014.917514) such over-hasty and uninformed dismissals in other areas.

So I used [Claude](https://claude.ai) to help me build a tool.

The tool measures the distance between what a field claims and what it reads. I've called it the Citation Asymmetry Detector, currently pre-release at version 0.2. The tool takes an area or concept that composition and rhetoric claims (e.g, composition pedagogy, invention, second-language writing, writing assessment) and measures two phenomena separately: how much the field's own journals cite the outside scholarship on that concept, and how much everyone outside the field does. The tool uses ISSNs to draw disciplinary boundaries with a list of named journals. On the disciplinary side, the tool [consults the *Bedford Bibliography*](https://doi.org/10.1080/07350198.2018.1424480) twice, via two separate routes: first it queries whether the field's canonical map has a place for the concept in question by traversing a crosswalk from the *Bedford Bibliography*'s subcategories to the defined concept. Next, it uses a vector database of the [*Bedford Bibliography*](https://search.worldcat.org/title/760902194) [indexed by meaning rather than keyword](https://github.com/tobi/qmd) to perform a semantic search and return results for text engaging that concept under other names. When the two routes disagree, the tool reports the disagreement, which often suggests the field engaged the concept but filed it differently---in other words, how the field masked the concept. That masking is the tool's real subject: it seeks what composition and rhetoric calls its concepts, then seeks those concepts under other names across other disciplines.

<!--more-->

Two cautions: first, the tool uses API keys to query databases notorious for undercounting humanities publications---that's a structural problem I can't fix. Second, because it runs on ISSNs, it catches only the nine indexed journals---*College Composition and Communication*, *College English*, *Rhetoric Review*, *Rhetoric Society Quarterly*, *JAC*, *Research in the Teaching of English*, *Teaching English in the Two-Year College*, *Computers and Composition*, and *Written Communication*. The tool doesn't catch unindexed journals. That's where a substantial portion of our field's scholarly work lives, and a fix I need to figure out if I can make before I think about releasing Citation Asymmetry Detector version 1.0: right now, it has a sizable blind spot. But as a first-pass survey of what our core journals cite *and don't cite*, the tool works to give me an idea of the discipline's blind spots.

With that caveat, following are some headline results. 

1. Petty, Richard E., and John T. Cacioppo. "The Elaboration Likelihood Model of Persuasion." In *Advances in Experimental Social Psychology*, vol. 19, edited by Leonard Berkowitz, 123–205. New York: Academic Press, 1986.\
   Audiences process persuasion in two ways, depending on their motivation and ability: centrally, by weighing arguments, or peripherally, through cues like source credibility. \
   Citations in rhetoric and composition journals: **3**. \
   Total citations: **15,277**.
2. Rogers, Everett M. *Diffusion of Innovations*. 5th ed. New York: Free Press, 2003. \
   Innovations spread through social systems over time, and adopters reinvent them as they adopt. \
   Citations in rhetoric and composition journals: **6**. \
   Total citations: **64,330**.
3. Spence, Michael. "Job Market Signaling." *Quarterly Journal of Economics* 87, no. 3 (1973): 355–74. \
   Employers rely on costly signals like education because they can't observe a job candidate's productivity. Education earns its returns by sorting candidates, whether or not it produces skill. \
   Citations in rhetoric and composition journals: **0**. \
   Total citations: **17,843**.
4. Sweller, John. "Cognitive Load during Problem Solving: Effects on Learning." *Cognitive Science* 12, no. 2 (1988): 257–85. \
   Working memory is limited, and some instructional formats consume it without producing learning. \
   Citations in rhetoric and composition journals: **1**. \
   Total citations: **10,533**.

By way of comparison, David Bartholomae's *Inventing the University* has 697 indexed citations.
