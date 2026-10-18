---
layout: post
title: "The Cheater"
date: 2026-10-17 18:49:35 -0700
categories: [Composition, Technology]
---
I'd like to imagine a college student in a writing class who uses a large language model to cheat.

Say the student enters English 101 on Day 1 of the semester and gets a paper copy of the syllabus, snaps pictures of the pages, and her phone OCRs the fulltext and drops it in her School files folder that syncs to her computer. She photographs the whiteboard with the teacher's notes and the LMS login. Later that night, doing her homework, she sets up two English 101 folders on her computer: one for binaries like PDFs and .jpgs, and one for text. She's decided she's going to cheat, and wants to have her files organized so they're maximally findable by both human and machine. Her text file folder hierarchy looks like this:

```text
english-101-text/
├── 1-reading/
│   ├── 1-syllabus-and-assignments/
│   │   ├── 01-syllabus.md
│   │   ├── 02-calendar.md
│   │   ├── 03-weekly-discussion-forums.md
│   │   ├── 04-peer-review-work.md
│   │   ├── 05-essay-1-literacy-narrative.md
│   │   ├── 06-essay-2-rhetorical-analysis.md
│   │   ├── 07-essay-3-documented-argument.md
│   │   ├── 08-essay-4-reflective-inquiry.md
│   │   └── 09-portfolio-assessment.md
│   ├── 2-lecture-notes/
│   │   ├── week-01-the-writing-process.md
│   │   ├── week-02-the-rhetorical-tradition.md
│   │   ├── week-03-producing-prose-ideas.md
│   │   └── week-04-feedback-and-review.md
│   ├── 3-assigned-readings/
│   │   ├── bernstein-charles-blood-on-the-cutting-room-floor.md
│   │   ├── brooks-frederick-no-silver-bullet.md
│   │   ├── kirschenbaum-matthew-prepare-for-the-textpocalypse.md
│   │   ├── lethem-jonathan-the-ecstasy-of-influence.md
│   │   ├── meadows-donella-leverage-points.md
│   │   ├── ong-walter-writing-is-a-technology-that-restructures-thought.md
│   │   └── salvatori-mariolina-conversations-with-texts.md
│   └── 4-feedback-received/
└── 2-writing/
    ├── 1-major-assignments/
    ├── 2-short-assignments/
    ├── 3-class-notes/
    ├── 4-reading-notes/
    ├── 5-method-and-reflection/
    └── 6-fragments-and-ideas/

12 directories, 20 files
```

Every .jpg and PDF that goes into the binaries folder gets its fulltext automatically slurped into a [markdown](https://www.markdownguide.org/getting-started/) (.md) file in the text folder hierarchy. She logs into the LMS and downloads every course document to her binaries folder, with the fulltext going to its appropriate place in the text file hierarchy. As her last tasks of the night, she sets up a private [GitHub repository](https://docs.github.com/en/get-started/learning-to-code/getting-started-with-git) for her text file folder so she can reach it from anywhere and manage her revisions, and configures [qmd](https://github.com/tobi/qmd) on her computer to set up a vector search text embeddings database for her text file folder. qmd lets her query her text file folder---call it her Archive---not just via lexical or keyword search, but semantically: by similarity in meaning.

<!--more-->

That week, she does the first reading assignment, and her digital highlights and notes are automatically extracted into the Archive's reading notes folder, linked to both the original PDF and its fulltext in the assigned readings folder. Her bibliography app automatically fetches the DOIs and formats the accompanying citations. She takes notes in class, photographs the whiteboard, completes the short LMS discussion forum assignments that ask for individualized reactions and responses to peers' ideas. She downloads those to the Archive too, and links them to their appropriate peer documents. The LMS and her computer's timing tracker date-stamp when the activities happen.

The student, taking inspiration from the canons of rhetoric and the teacher's instructions about the writing process, soon adds a new folder to her Archive. It holds instruction files for the LLM.

```text
english-101-text/
├── 0-governance/
│   ├── README.md
│   ├── dashboard.md
│   ├── instructions.md
│   ├── log.md
│   ├── structure.md
│   └── style.md
├── 1-reading/
│   ├── 1-syllabus-and-assignments/
│   ├── 2-lecture-notes/
│   ├── 3-assigned-readings/
│   └── 4-feedback-received/
└── 2-writing/
    ├── 1-major-assignments/
    ├── 2-short-assignments/
    ├── 3-class-notes/
    ├── 4-reading-notes/
    ├── 5-method-and-reflection/
    └── 6-fragments-and-ideas/

13 directories, 6 files
```

The readme describes the content: what the course folder is about and what types of texts are in it. The instructions tell the bot how to work: what kinds of help the student wants, and how that help should be presented. The structure tells the bot where different items live and how they're formatted, with what metadata, and what the linking conventions are. Style governs text conventions: what output should look and sound like, and what formats and genres should be followed, in what tone and voice. Dashboard is the LLM's working memory: it reports status, recent actions, next actions. Log is the LLM's archival memory: it cumulatively records everything that's been done from the start.

The semester progresses to brainstorming and developing and drafting for the first major essay assignment. The student opens her LLM chat window and asks the bot to summarize the assignment requirements and use qmd search to find the top six areas in her notes where she's already written the most about the assignment's topic.

The LLM uses qmd to search and return the six ranked matches from the student's Archive; the student likes items 2, 3, 5, and 6, and doesn't think items 1 and 4 are worthwhile. Item 3 has the most immediacy and feels the most developed, so the student decides to start there; item 5 feels most challenging to resolve, so the student decides to place it at the end and write toward it. The student give the bot the start and end points and asks what possible sequences might be interesting. The bot suggests 3, 6, 2, 5, and points out possible transitions between the ideas. The student agrees and asks the bot to synthesize a draft. The bot gives her the output; the student smooths out the wording, crafts transitions between paragraphs, adds an introduction, and brings it to peer review.

Her peers tell her it's well-crafted and practically seamless but bland. The peer review comments have nothing to say about the machine-generated text, because it's largely unobjectionable and unmemorable. They want her to follow through on the personal detail from the first paragraph and why it makes part 5 uncomfortable. They point out the same connections between the machine-written parts and the human-written parts that the student writer saw, but help her ask why they're important. She saves the fulltext of her peers' feedback as well, and follows through on the teacher's instructions to write a plan for what aspects of the feedback she will use or discard. She feeds those materials to the bot, as well.

The bot reviews the materials and suggests a revised ending, with several places for insertion of detail to extend the personal themes from the beginning. The bot notes that the assignment instructions require three sources, and she's only citing two. She doesn't like the other sources assigned in the class, and asks the bot about any common threads in the highlights from her notes. The bot finds that both her sources quote the same author, and she'd highlighted those passages. She asks the bot to find more about that author. The bot reports back with three available articles and their citation counts and abstracts. One of the abstracts sounds good to her; she asks the bot to download the PDF and skim the article for possibly relevant quotations. The fulltext gets extracted, as usual. The bot returns three candidate quotations, and she asks the bot to explain the connections between the quotations and her own ideas. She patches one of the quotations and connections into her third paragraph. When she finishes with the typing, she exports the formatted citations from her citations manager into the markdown document and has the bot proofread for errors. The completed draft goes from markdown via [Pandoc](https://pandoc.org) to PDF to turn in to the teacher for feedback.

The teacher first runs the paper through the LMS plagiarism detection package: fine, no problems detected. The teacher next runs the paper through the LMS AI detection package: `flagged`, 85% machine-generated text. 

Is this a worst-case scenario? Where did the [labor](/weblog/2026/10/15/contracts-whys-whens-and-wherefores.html) of teaching and learning happen and not happen, and what should the student and teacher do?

