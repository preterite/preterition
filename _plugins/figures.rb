# figures.rb -- the weblog's figures, as data.
#
# _data/figures.yml describes each figure the weblog publishes as a file of
# its own. This generator hands every post an entry names under appears_in
# a `figures` list -- each entry's fields with its id -- so the head can
# describe the figure inside the post's structured data. And it refuses the
# build when the data is wrong, as series.rb refuses a wrong collection: a
# field missing, an asset the site does not carry, a name under appears_in
# that is no post, or a post that renders a figure's include without being
# named under that figure's appears_in. The last is the point of the file:
# an index reads a figure's license only from a page that describes it, so
# every page that shows the figure must, and remembering is not enough.
#
# Posts are matched by file name without its extension, never by title, as
# collections match theirs.
module Preterite
  class Figures < Jekyll::Generator
    safe true
    priority :normal

    FIELDS = %w[name number date asset include appears_in credit citation].freeze

    def generate(site)
      data = site.data["figures"]
      return if data.nil?

      license = data["license"] || {}
      %w[name url terms].each do |k|
        refuse("data's license", "carries no #{k}") if blank?(license[k])
      end
      by_name = site.posts.docs.each_with_object({}) { |d, h| h[d.basename_without_ext] = d }
      carried = site.static_files.flat_map { |f| [f.relative_path, f.url] }

      (data["figures"] || {}).each do |id, f|
        FIELDS.each { |k| refuse(id, "carries no #{k}") if blank?(f[k]) }
        refuse(id, "names #{f['asset']}, which the site does not carry") unless carried.include?(f["asset"])
        names = Array(f["appears_in"]).map(&:to_s)
        names.each do |name|
          doc = by_name[name]
          refuse(id, "names #{name}, which is not a post") if doc.nil?
          (doc.data["figures"] ||= []) << f.merge("id" => id)
        end
        tag = /\{%-?\s*include\s+#{Regexp.escape(f['include'])}[\s%]/
        site.posts.docs.each do |d|
          next unless d.content =~ tag
          next if names.include?(d.basename_without_ext)
          refuse(id, "is shown by #{d.basename_without_ext} through #{f['include']}, which appears_in does not name")
        end
      end
    end

    private

    def blank?(v)
      v.nil? || (v.respond_to?(:empty?) && v.empty?) || v.to_s.strip.empty?
    end

    def refuse(where, why)
      raise Jekyll::Errors::FatalException, "Figure #{where} #{why}."
    end
  end
end
