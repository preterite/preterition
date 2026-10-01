# series.rb -- the weblog's collections.
#
# A collection is a run of entries written to be read together, gathered on
# a hub page at /weblog/series/<slug>.html. The hub's source sits in
# weblog/series/ and names its entries in its own front matter, as a list of
# post file names in reading order under `entries:`; its `description:` is
# the collection's abstract. A collection is gathered only once its last
# entry is published: a hub names what is complete, never what is planned.
#
# This generator does three things with that list. It refuses the build when
# the list is wrong, as category_guard.rb refuses an unknown category: an
# entry naming no post, an entry carrying no description of its own (the
# hub prints each entry's description as its summary, and the same text is
# the entry's meta description), or an entry claimed by two collections. It
# hands each member entry a `series` value, the hub's title and address, so
# the entry can say which collection it belongs to. And it gives the weblog
# sidebar its Collections list as site.data["series"], ordered by each
# collection's earliest entry.
#
# Entries are matched by file name and never by title or slug: a file name
# is unique within weblog/_posts/ and carries its own date.
module Preterite
  class Series < Jekyll::Generator
    safe true
    priority :normal

    DIR = "weblog/series/"

    def generate(site)
      hubs = site.pages.select do |p|
        p.relative_path.start_with?(DIR) && p.ext == ".md"
      end
      return if hubs.empty?

      by_name = site.posts.docs.each_with_object({}) { |d, h| h[d.basename] = d }
      claimed = {}
      listing = []

      hubs.sort_by(&:relative_path).each do |hub|
        where = hub.relative_path
        title = hub.data["title"].to_s.strip
        refuse(where, "carries no title") if title.empty?
        refuse(where, "carries no description, which is its abstract") if hub.data["description"].to_s.strip.empty?
        names = hub.data["entries"]
        refuse(where, "names no entries") unless names.is_a?(Array) && !names.empty?

        members = names.map do |name|
          doc = by_name[name.to_s]
          refuse(where, "names #{name}, which is not a post") if doc.nil?
          refuse(where, "names #{name}, which carries no description") if doc.data["description"].to_s.strip.empty?
          refuse(where, "names #{name}, which #{claimed[name]} already claims") if claimed[name]
          claimed[name] = where
          doc
        end

        link = { "title" => title, "url" => hub.url }
        members.each { |d| d.data["series"] = link }
        hub.data["series_entries"] = members.map do |d|
          { "title" => d.data["title"], "url" => d.url, "date" => d.date,
            "description" => d.data["description"] }
        end
        listing << link.merge("first" => members.map(&:date).min)
      end

      site.data["series"] = listing.sort_by { |s| s["first"] }
      Jekyll.logger.info "Collections:",
        "#{listing.size} hubs, #{claimed.size} entries"
    end

    private

    def refuse(where, why)
      raise Jekyll::Errors::FatalException, "Collection #{where} #{why}."
    end
  end
end
