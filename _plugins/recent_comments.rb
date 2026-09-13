# recent_comments.rb -- the weblog sidebar's Recent Comments, derived once
# per build.
#
# A comment is a file under _data/welcomments/<slug>/ and knows nothing of
# the entry it answers: the entry is its folder's name. The widget wants the
# five newest comments across every entry, each with its entry's title and
# address, and Liquid has no good way to pair a folder with a post -- it
# would scan site.posts once per comment, on every page. So the pairing
# happens here, in one pass over the tree before anything renders, and
# the include reads site.data.recent_comments as if it were a data file.
#
# Only comments count: pingbacks, trackbacks and webmentions carry a type
# and are left out, being links rather than conversation. Comments whose
# entry is not in this build are left out too, and counted in the build
# log -- before the archive lands that is every historical comment, and
# the widget renders nothing rather than link pages that do not exist.
# The log line is also the check that every comment folder has its entry:
# a nonzero count after the archive lands names a folder whose name and
# the post's slug disagree.
#
# A generator rather than a hook, because it needs every post read and
# every data file loaded before it runs, and that is what the generator
# phase is. Runs in the Actions build; the Pages plugin whitelist does not
# govern that build (_config.yml, Plugins).
require "time"

module Preterite
  class RecentComments < Jekyll::Generator
    safe true
    priority :low

    COUNT = 5

    def generate(site)
      tree = site.data["welcomments"]
      return unless tree.is_a?(Hash)

      by_slug = {}
      site.posts.docs.each { |post| by_slug[post.data["slug"]] = post }

      rows = []
      orphans = []
      tree.each do |slug, files|
        next unless files.is_a?(Hash)
        post = by_slug[slug]
        if post.nil?
          orphans << slug
          next
        end
        files.each_value do |c|
          next unless c.is_a?(Hash) && c["id"] && c["date"]
          next unless c["type"].to_s.empty?
          rows << {
            "id"         => c["id"],
            "author"     => c.dig("author", "name").to_s,
            "date"       => c["date"],
            "post_title" => post.data["title"],
            "post_url"   => post.url,
            "stamp"      => Time.iso8601(c["date"]),
          }
        end
      end

      rows.sort_by! { |r| r["stamp"] }.reverse!
      site.data["recent_comments"] =
        rows.first(COUNT).map { |r| r.reject { |k, _| k == "stamp" } }

      Jekyll.logger.info "Recent comments:",
        "#{rows.size} comments on #{tree.size - orphans.size} entries; " \
        "#{orphans.size} comment folders without an entry in this build"
    end
  end
end
