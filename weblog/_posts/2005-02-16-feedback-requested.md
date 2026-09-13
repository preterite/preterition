---
layout: post
title: "Feedback Requested"
date: 2005-02-16 18:57:28 -0800
categories:
  - "Asides"
permalink: /weblog/2005/02/16/feedback-requested.html
redirect_from:
  - /blog/2005/02/16/feedback-requested/
wp_id: 457
wp_status: publish
comment_count: 5
---
I've been tinkering with the layout some, trying to get that tall skinny graphic on the right side to line up flush with the top box; unfortunately, I'm bedeviled by the fact that all these browsers interpret the CSS [box](http://www.thenoodleincident.com/tutorials/box_lesson/) [model](http://www.w3.org/TR/REC-CSS2/box.html) differently. Basically, the top black area has some padding so that the left menu and middle body text don't butt flush up against it, so I've tried to remedy that by giving the right box a negative top margin. Unfortunately, what this seems to mean so far is that in Safari, OmniWeb, and Konqueror-based browsers, a minus 12 pixel top margin gets the picture flush, and gets it with just a one-pixel line in Mozilla-type browsers. Unfortunately, it winds up looking like crap in Opera (which is really weird: is the rest of the browser industry wrong, or is the [W3C's](http://w3c.org/Style/CSS/) [Håkon Wium Lie](http://www.opera.com/company/about/executives/) wrong?), and even worse crap in Macintosh MSIE (which isn't weird at all).

According to my site statistics, most of the pageviews I'm getting come from Mozilla-type browsers. So I'd like to ask you for feedback: how does the layout look now, in your browser, especially with how that right-side graphic lines up with the black top box? Much obliged, dear reader.
