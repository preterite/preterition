# tracks.rb -- the Listening widget's song pages.
#
# _data/listening_paths.yml maps a song's slug to post file names in display
# order. For each mapped song this generator writes a page at
# /weblog/listening/<slug>.html, laid out by _layouts/track.html: the song,
# its posts as a tracklist, and its Up Next: the other songs it shares posts
# with, most shared first, then the songs _data/listening_next.yml gives it.
# That file holds the fallback alone, links only, written offline with the
# mapping: the songs nearest by the balance's measure, filled to a floor of
# three, at most one link from a classical piece to another, each link
# returned where the other song has room. The generator also writes the
# page's address and running time onto the song's own row
# of site.data["site_songs"], so _includes/listening.html can link a track
# and print its length without knowing the slug rule.
#
# A slug is made from title and artist, never from a row's position, since
# the song file's order is a shuffle and changes on any re-export. The rule:
# decompose to NFKD, drop every character outside ASCII, lowercase, read an
# ampersand as "and", run every other non-alphanumeric stretch together as
# one hyphen, trim the ends, and join title to artist with two hyphens. The
# offline script that writes the mapping applies the same rule; the two
# must agree, and the build refuses when they visibly do not.
#
# The build is refused when a mapping entry names no post, when a slug
# matches no row of the song file, when two rows make one slug, or when a
# row of the song file has no path: a song is added with its path, made
# offline before the push and never in the build. It is refused too when
# the Up Next file names a slug that is mapped to no path, or gives a song
# itself.
#
# Running time is reading time: each post's word_count, from
# _plugins/word_count.rb, at WPM words a minute. The rate is set here and
# nowhere else. An entry named in _data/track_lengths.yml adds the time
# given there: the length of a video the entry carries, or a length set for
# the entry by hand. A picture with no prose adds nothing unless it is named.
# The build is refused when that file names no post or gives a time it
# cannot read.
module Preterite
  class Tracks < Jekyll::Generator
    safe true
    priority :low

    DIR = "weblog/listening"
    WPM = 240

    def self.slug(title, artist)
      "#{part(title)}--#{part(artist)}"
    end

    def self.part(s)
      s = s.to_s.unicode_normalize(:nfkd)
      s = s.encode("ASCII", invalid: :replace, undef: :replace, replace: "")
      s = s.downcase.gsub("&", " and ")
      s.gsub(/[^a-z0-9]+/, "-").gsub(/\A-+|-+\z/, "")
    end

    # "2:27" to 147. A bare number would mean YAML read the time as base 60.
    def self.parse(given, name)
      m = given.to_s.match(/\A(\d+):([0-5]\d)\z/)
      unless given.is_a?(String) && m
        raise Jekyll::Errors::FatalException,
          "_data/track_lengths.yml gives #{name} the time #{given.inspect}, which is not minutes and seconds in quotes."
      end
      m[1].to_i * 60 + m[2].to_i
    end

    def self.seconds(words)
      (words.to_i * 60.0 / WPM).round
    end

    # "4:07", or "1:02:15" past the hour, the way a player shows a track.
    def self.clock(sec)
      h, rest = sec.divmod(3600)
      m, s = rest.divmod(60)
      h.positive? ? format("%d:%02d:%02d", h, m, s) : format("%d:%02d", m, s)
    end

    # The same span as an HTML duration, for a <time> element's datetime.
    def self.iso(sec)
      h, rest = sec.divmod(3600)
      m, s = rest.divmod(60)
      "PT" + (h.positive? ? "#{h}H" : "") + "#{m}M#{s}S"
    end

    def generate(site)
      paths = site.data["listening_paths"]
      return if paths.nil? || paths.empty?

      rows = {}
      Array(site.data["site_songs"]).each do |row|
        key = Tracks.slug(row["title"], row["artist"])
        refuse("two rows of the song file make the slug #{key}") if rows[key]
        rows[key] = row
      end

      by_name = site.posts.docs.each_with_object({}) { |d, h| h[d.basename] = d }
      extra = {}
      (site.data["track_lengths"] || {}).each do |name, given|
        refuse("names #{name}, which is not a post", "track_lengths") unless by_name[name.to_s]
        extra[name.to_s] = Array(given).sum { |g| Tracks.parse(g, name) }
      end
      length = ->(d) { Tracks.seconds(d.data["word_count"]) + extra.fetch(d.basename, 0) }

      songs = {}
      paths.each do |key, names|
        row = rows[key.to_s]
        refuse("names the slug #{key}, which matches no row of the song file") if row.nil?
        refuse("gives #{key} no posts") unless names.is_a?(Array) && !names.empty?
        songs[key.to_s] = names.map do |name|
          doc = by_name[name.to_s]
          refuse("gives #{key} the post #{name}, which is not a post") if doc.nil?
          doc
        end
      end

      unmapped = rows.keys - songs.keys
      unless unmapped.empty?
        refuse("gives no path to #{unmapped.size} of the song file's songs: " \
               "#{unmapped.first(5).join(', ')}#{unmapped.size > 5 ? ', ...' : ''}; " \
               "a song is added with its path")
      end

      owners = Hash.new { |h, k| h[k] = [] }
      songs.each { |key, docs| docs.each { |d| owners[d.basename] << key } }

      fallback = {}
      (site.data["listening_next"] || {}).each do |key, others|
        refuse("names the slug #{key}, which is mapped to no path", "listening_next") if songs[key.to_s].nil?
        fallback[key.to_s] = Array(others).map do |o|
          refuse("gives #{key} the song #{o}, which is mapped to no path", "listening_next") if songs[o.to_s].nil?
          refuse("gives #{key} itself as Up Next", "listening_next") if o.to_s == key.to_s
          o.to_s
        end
      end

      songs.each do |key, docs|
        row = rows[key]
        entries = docs.map do |d|
          sec = length.(d)
          { "title" => d.data["title"], "url" => d.url, "date" => d.date,
            "length" => Tracks.clock(sec), "duration" => Tracks.iso(sec) }
        end
        total = docs.sum { |d| length.(d) }

        shared = Hash.new(0)
        docs.each { |d| owners[d.basename].each { |o| shared[o] += 1 unless o == key } }
        nxt = shared.keys.sort_by { |o| [-shared[o], rows[o]["title"].to_s.downcase] }
        fallback.fetch(key, []).each { |o| nxt << o unless nxt.include?(o) }

        page = Jekyll::PageWithoutAFile.new(site, site.source, DIR, "#{key}.html")
        page.data.merge!(
          "layout" => "track", "title" => row["title"], "artist" => row["artist"],
          "sitemap" => false, "track_entries" => entries,
          "up_next" => nxt.map { |o| { "title" => rows[o]["title"],
                                       "artist" => rows[o]["artist"],
                                       "url" => "/#{DIR}/#{o}.html" } })
        site.pages << page

        row["url"] = "/#{DIR}/#{key}.html"
        row["length"] = Tracks.clock(total)
        row["duration"] = Tracks.iso(total)
      end

      Jekyll.logger.info "Listening:",
        "#{songs.size} song pages, #{owners.size} posts"
    end

    private

    def refuse(why, file = "listening_paths")
      raise Jekyll::Errors::FatalException,
        "_data/#{file}.yml #{why}."
    end
  end
end
