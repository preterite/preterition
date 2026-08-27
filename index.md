---
title: "Index"
description: "Mike Edwards, Associate Professor: rhetoric, composition, technology, economy."
---
<div class="panel">
  <div>
    <div class="headrow">
      <div class="headword">
        <h1>
          <span class="hw g1" aria-hidden="true">Edwards, Mike</span>
          <span class="hw g2" aria-hidden="true">Edwards, Mike</span>
          <span class="hw g3" aria-hidden="true">Edwards, Mike</span>
          <span class="hw lead">Edwards, Mike</span>
        </h1>
        <p class="subjects">composition, economy, rhetoric, technology</p>
      </div>
      <button class="hex" aria-label="Search this site"></button>
    </div>
  </div>

  <div>
    <p class="signoff">
      <span class="own-line"><span class="k">listening:</span>{% comment %} latest track from _data/, build-time fetch {% endcomment %}</span>
      <span class="own-line"><span class="k">next:</span>{% comment %} next event from _data/, build-time fetch {% endcomment %}</span>
      <span class="own-line"><span class="k">built:</span><a href="/about.html#colophon">colophon</a></span>
      <span><span class="k">terms:</span><a href="https://creativecommons.org/licenses/by-nc-sa/4.0/">CC BY-NC-SA 4.0</a></span>
    </p>
    <div class="foot">
      <p class="tagline">
        <span class="g1" aria-hidden="true"></span>
        <span class="g2" aria-hidden="true"></span>
        <span class="g3" aria-hidden="true"></span>
        <span class="lead"></span>
      </p>
      <img class="bug" alt="" src="/img/me-bug.svg" width="10" height="22">
    </div>
  </div>
</div>

<nav class="wall" id="wall" aria-label="Site index">

  {% assign t = site.pages | where: "url", "/about.html" | first %}
  <a class="entry" data-k="about" href="/about.html">
    <span class="strip" aria-hidden="true"></span>
    <span class="name">about</span>
    <span class="leader" aria-hidden="true"></span>
    <span class="detail" data-k="about"><span class="locator">&sect; colophon</span><span class="gloss">{{ t.description | markdownify | remove: "<p>" | remove: "</p>" | strip }}</span></span>
  </a>

  {% assign t = site.pages | where: "url", "/contact.html" | first %}
  <a class="entry" data-k="contact" href="/contact.html">
    <span class="strip" aria-hidden="true"></span>
    <span class="name">contact</span>
    <span class="leader" aria-hidden="true"></span>
    <span class="detail" data-k="contact"><span class="locator">two registers</span><span class="gloss">{{ t.description | markdownify | remove: "<p>" | remove: "</p>" | strip }}</span></span>
  </a>

  <a class="entry" data-k="cv" href="/resources/edwards_cv_2026.pdf">
    <span class="strip" aria-hidden="true"></span>
    <span class="name">cv</span>
    <span class="leader" aria-hidden="true"></span>
    <span class="detail" data-k="cv"><span class="locator">pdf</span><span class="gloss">The record made tidy.</span></span>
  </a>

  {% assign t = site.pages | where: "url", "/presentations.html" | first %}
  <a class="entry" data-k="presentations" href="/presentations.html">
    <span class="strip" aria-hidden="true"></span>
    <span class="name">presentations</span>
    <span class="leader" aria-hidden="true"></span>
    <span class="detail" data-k="presentations"><span class="locator">3 talks</span><span class="gloss">{{ t.description | markdownify | remove: "<p>" | remove: "</p>" | strip }}</span></span>
  </a>

  {% assign t = site.pages | where: "url", "/projects.html" | first %}
  <a class="entry" data-k="projects" href="/projects.html">
    <span class="strip" aria-hidden="true"></span>
    <span class="name">projects</span>
    <span class="leader" aria-hidden="true"></span>
    <span class="detail" data-k="projects"><span class="locator">3 builds</span><span class="gloss">{{ t.description | markdownify | remove: "<p>" | remove: "</p>" | strip }}</span></span>
  </a>

  {% assign t = site.pages | where: "url", "/scholarship.html" | first %}
  <a class="entry" data-k="scholarship" href="/scholarship.html">
    <span class="strip" aria-hidden="true"></span>
    <span class="name">scholarship</span>
    <span class="leader" aria-hidden="true"></span>
    <span class="detail" data-k="scholarship"><span class="locator">3 articles</span><span class="gloss">{{ t.description | markdownify | remove: "<p>" | remove: "</p>" | strip }}</span></span>
  </a>

  {% assign t = site.pages | where: "url", "/service.html" | first %}
  <a class="entry" data-k="service" href="/service.html">
    <span class="strip" aria-hidden="true"></span>
    <span class="name">service</span>
    <span class="leader" aria-hidden="true"></span>
    <span class="detail" data-k="service"><span class="locator">4 posts</span><span class="gloss">{{ t.description | markdownify | remove: "<p>" | remove: "</p>" | strip }}</span></span>
  </a>

  {% assign t = site.pages | where: "url", "/teaching.html" | first %}
  <a class="entry" data-k="teaching" href="/teaching.html">
    <span class="strip" aria-hidden="true"></span>
    <span class="name">teaching</span>
    <span class="leader" aria-hidden="true"></span>
    <span class="detail" data-k="teaching"><span class="locator">4 syllabi</span><span class="gloss">{{ t.description | markdownify | remove: "<p>" | remove: "</p>" | strip }}</span></span>
  </a>

  {% assign t = site.pages | where: "url", "/weblog/" | first %}
  <a class="entry" data-k="weblog" href="/weblog/">
    <span class="strip" aria-hidden="true"></span>
    <span class="name">weblog</span>
    <span class="leader" aria-hidden="true"></span>
    <span class="detail" data-k="weblog"><span class="locator">2003&ndash;</span><span class="gloss">{{ t.description | markdownify | remove: "<p>" | remove: "</p>" | strip }}</span></span>
  </a>

</nav>
