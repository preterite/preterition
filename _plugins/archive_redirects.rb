# archive_redirects.rb -- honour the old archive addresses.
#
# The weblog's archive pages -- one per month, one per category -- are
# written by jekyll-archives at the addresses _config.yml sets. WordPress
# served the same archives under /blog/: /blog/2004/03/ for a month,
# /blog/category/<slug>/ for a category, and the category slugs were the
# old taxonomy's, which the migration consolidated. A reader following any
# of those links should arrive at the archive that replaced it, and on a
# static host the only way to honour an old address is a file at that
# address. WordPress also served a year at /blog/2004/; this site has no
# year archive, and those addresses are left to 404 rather than answered by
# a page that exists only to catch them.
#
# jekyll-redirect-from writes those files for pages that declare
# `redirect_from`, but an archive page is generated during the build and
# declares nothing, and the two generators share a priority, so neither
# can rely on running after the other. This one runs at low priority,
# after both, finds the archive pages jekyll-archives added, and writes
# each stub itself through jekyll-redirect-from's own page class -- the
# same meta-refresh stub every other retired address on the site gets.
#
# A month derives its old address from the archive's own date.
# Categories read _data/category-redirects.yml, the old slugs mapped to
# the categories they became, derived from the migration database; an old
# category whose new category has no archive page in this build gets no
# stub, and the build log says so.
#
# One more retired address is not an archive: the feed's. WordPress served
# it at /blog/feed/, and jekyll-feed writes it at /feed.xml. A meta refresh
# moves a browser and not a feed reader, which follows only the HTTP
# redirects a static host cannot issue. A duplicate Atom document at the old
# address was weighed and not built (2026-10-01). The feed's stub is the
# page jekyll-redirect-from writes for every other retired address, plus one
# autodiscovery link naming the new feed, so a reader that looks for that
# link can find its way. It is built here rather than through a site-wide
# redirect layout, which would put the link on every stub. The stub is
# written whether or not any archive page exists.
require "cgi"

module Preterite
  class ArchiveRedirects < Jekyll::Generator
    safe true
    priority :low

    OLD_FEED = "/blog/feed/"
    FEED = "/feed.xml"

    # jekyll-redirect-from's own redirect page, with the autodiscovery link
    # added after the canonical one.
    FEED_STUB = <<~HTML
      <!DOCTYPE html>
      <html lang="en-US">
        <meta charset="utf-8">
        <title>Redirecting&hellip;</title>
        <link rel="canonical" href="%{to}">
        <link rel="alternate" type="application/atom+xml" title="%{title}" href="%{to}">
        <script>location="%{to}"</script>
        <meta http-equiv="refresh" content="0; url=%{to}">
        <meta name="robots" content="noindex">
        <h1>Redirecting&hellip;</h1>
        <a href="%{to}">Click here if you are not redirected.</a>
      </html>
    HTML

    def generate(site)
      return unless defined?(JekyllRedirectFrom::RedirectPage)

      feed_stub(site)
      Jekyll.logger.info "Feed redirect:", "#{OLD_FEED} -> #{FEED}"

      return unless defined?(Jekyll::Archives::Archive)

      archives = site.pages.select { |p| p.is_a?(Jekyll::Archives::Archive) }
      return if archives.empty?

      by_category = {}
      written = 0
      archives.each do |a|
        case a.type
        when "month"
          written += stub(site, format("/blog/%04d/%02d/", a.date.year, a.date.month), a.url)
        when "category"
          by_category[a.slug] = a
        end
      end

      missing = []
      Array(site.data["category-redirects"]).each do |row|
        target = by_category[Jekyll::Utils.slugify(row["to"].to_s)]
        if target.nil?
          missing << row["from"]
          next
        end
        written += stub(site, row["from"], target.url)
      end

      Jekyll.logger.info "Archive redirects:",
        "#{written} stubs written for #{archives.size} archive pages; " \
        "#{missing.size} old category addresses with no archive to point at" +
        (missing.empty? ? "" : " (#{missing.join(', ')})")
    end

    private

    def feed_stub(site)
      page = JekyllRedirectFrom::RedirectPage.from_paths(site, OLD_FEED, FEED)
      page.data["layout"] = nil
      page.content = format(FEED_STUB, to: page.redirect_to,
                            title: CGI.escapeHTML(site.config["title"].to_s))
      site.pages << page
    end

    def stub(site, from, to)
      site.pages << JekyllRedirectFrom::RedirectPage.from_paths(site, from, to)
      1
    end
  end
end
