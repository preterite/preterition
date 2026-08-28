# Gemfile -- preterite.net
#
# Plain Jekyll, not the `github-pages` gem. That gem pins Jekyll to the
# version Pages' native builder runs and loads its whitelist; this site
# builds in Actions (RULED 2026-08-18), so the pin would be a constraint
# inherited from a builder not in use. Bundler locks the actual versions in
# Gemfile.lock, which is committed so the workflow builds what you ran.

source "https://rubygems.org"

gem "jekyll", "~> 4.3"
gem "jekyll-redirect-from"

# The weblog's feed. jekyll-feed is a generator plugin: it reads site.posts
# during the build and writes an Atom document to /feed.xml. It is named here
# as well as in _config.yml because this bundle is plain Jekyll rather than
# the github-pages gem -- nothing arrives implicitly, and a plugin listed in
# _config.yml and absent from the bundle fails the build rather than being
# quietly ignored.
gem "jekyll-feed"

# Ruby 3.4 stopped bundling these; Jekyll 4.3 still wants them.
gem "csv"
gem "base64"
gem "bigdecimal"
gem "logger"
