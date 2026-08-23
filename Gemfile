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

# Ruby 3.4 stopped bundling these; Jekyll 4.3 still wants them.
gem "csv"
gem "base64"
gem "bigdecimal"
gem "logger"
