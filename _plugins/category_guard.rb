# Every entry's categories are drawn from the closed set in
# _data/categories.yml. A name outside that set is a typo rather than a new
# category, and left unchecked it builds a second archive page, splits
# entries that belong together, and publishes an address nothing links to.
#
# The build is refused rather than warned. A warning in a log nobody reads
# deploys the mistake; a non-zero exit leaves the live site standing, which
# is the same reasoning strict_front_matter rests on.
#
# post_read runs after every document is read and after the per-document
# init hooks, so the categories seen here are the ones the entry will
# actually carry.
#
# The scope is every entry this build includes. An entry dated in the
# future is dropped by Jekyll before this runs and so goes unchecked; it
# also goes unpublished, and it is checked on the first build after its
# date passes, which is the build that would have published the mistake.

Jekyll::Hooks.register :site, :post_read do |site|
  known = site.data["categories"]
  unless known.is_a?(Array) && !known.empty?
    raise "category guard: _data/categories.yml must hold a non-empty list " \
          "of category names"
  end

  strays = []
  site.posts.docs.each do |post|
    Array(post.data["categories"]).each do |name|
      strays << "#{post.relative_path}: #{name.inspect}" unless known.include?(name)
    end
  end

  unless strays.empty?
    raise "category guard: #{strays.length} entry category name(s) outside " \
          "_data/categories.yml:\n  " + strays.join("\n  ")
  end
end
