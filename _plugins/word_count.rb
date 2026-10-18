# _plugins/word_count.rb -- every entry's length, counted once, before
# anything renders.
#
# Each post is handed `word_count`, an integer, and `word_count_display`,
# the same number as a reader sees it ("3,412 words", "1 word", "0 words").
# The dateline shows it on the index card and on the entry page, the month,
# category and collection lists show it beside each entry, and the entry's
# structured data carries it as `wordCount`. One number, counted in one
# place, so the reader and the machine are told the same thing.
#
# What is counted is the prose a reader reads. The count is taken from the
# entry's own source, before Liquid or Markdown run, and leaves out:
#   front matter, Liquid tags and HTML comments;
#   fenced code blocks;
#   images and their alt text, Markdown or <img>;
#   link destinations (a link's text counts, its address does not);
#   raw HTML tags (their text counts);
#   the references block: a `References` heading to the next heading of
#   the same rank or higher, or a bold "Works Cited" line to the end.
# Anything an include draws -- a figure and its hidden description -- is
# outside the source and so outside the count. A token is a word when it
# holds a letter or a digit, so a dash or a rule is not.
#
# A generator rather than a filter in the layout, because the lists need
# the number before the entries render, and the collection hubs copy it in
# _plugins/series.rb, which this one runs ahead of.
module Preterite
  class WordCount < Jekyll::Generator
    safe true
    priority :high

    HEAD   = /\A(\#{1,6})\s+(.*?)\s*\#*\s*\z/
    REFS   = /\Areferences\z/i
    WC     = /\A(\*\*|__)\s*works cited:?\s*(\*\*|__)\s*\z/i
    FENCE  = /\A\s*(`{3,}|~{3,})/
    WORD   = /[[:alnum:]]/
    SPACES = %w[nbsp ensp emsp thinsp].freeze

    def generate(site)
      site.posts.docs.each do |doc|
        n = count(doc.content.to_s)
        doc.data["word_count"] = n
        doc.data["word_count_display"] = display(n)
      end
      Jekyll.logger.info "Word counts:", "#{site.posts.docs.size} entries"
    end

    def display(n)
      digits = n.to_s.reverse.scan(/\d{1,3}/).join(",").reverse
      n == 1 ? "1 word" : "#{digits} words"
    end

    def count(text)
      strip(text).scan(/[^[:space:]]+/).count { |tok| tok.match?(WORD) }
    end

    private

    # Block-level pass: comments, fences and the references block, by line.
    def lines_kept(text)
      text = text.gsub(/\{%-?\s*comment\s*-?%\}.*?\{%-?\s*endcomment\s*-?%\}/m, " ")
      text = text.gsub(/<!--.*?-->/m, " ")
      out, fence, skip_rank = [], nil, nil
      text.split("\n", -1).each do |line|
        f = line.match(FENCE)
        if fence
          fence = nil if f && f[1][0] == fence[0] && f[1].length >= fence.length
          next
        end
        if f
          fence = f[1]
          next
        end
        h = line.match(HEAD)
        unless skip_rank.nil?
          next unless h && h[1].length <= skip_rank
          skip_rank = nil
        end
        if h && h[2].match?(REFS)
          skip_rank = h[1].length
          next
        end
        if line.strip.match?(WC)
          skip_rank = 0
          next
        end
        out << line
      end
      out.join("\n")
    end

    # Inline pass: what is markup and not prose.
    def strip(text)
      t = lines_kept(text)
      t = t.gsub(/\{%.*?%\}|\{\{.*?\}\}/m, " ")
      t = t.gsub(/!\[[^\]]*\]\([^)]*\)/, " ")
      t = t.gsub(/<img\b[^>]*>/i, " ")
      t = t.gsub(/^\s*\[[^\]]+\]:\s*\S+.*$/, " ")
      t = t.gsub(/\[\^[^\]]+\]:?/, " ")
      t = t.gsub(/\[([^\]]*)\]\([^)]*\)/, '\1')
      t = t.gsub(/\[([^\]]*)\]\[[^\]]*\]/, '\1')
      t = t.gsub(/<https?:\/\/[^>]+>/, " ")
      t = t.gsub(/\{:[^}]*\}/, " ")
      t = t.gsub(/<[^>]+>/, " ")
      t = t.gsub(/&#(\d+);/) { [$1.to_i].pack("U") rescue " " }
      t = t.gsub(/&#x([0-9a-f]+);/i) { [$1.hex].pack("U") rescue " " }
      t.gsub(/&([a-z][a-z0-9]*);/i) { SPACES.include?($1.downcase) ? " " : "" }
    end
  end
end
