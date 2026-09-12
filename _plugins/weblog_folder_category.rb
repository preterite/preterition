# weblog_folder_category.rb -- keep the source folder's name out of the
# taxonomy.
#
# The posts live at weblog/_posts/ so that the content tree mirrors the
# address tree, and Jekyll reads every directory above a _posts/ folder as a
# category (Document#initialize, categories_from_path). Left alone, every
# post would carry "weblog" beside its own categories, the layout would
# print "Filed under weblog, ...", and site.categories would hold a
# twenty-third category containing all of them -- the CMS's residue in a
# taxonomy consolidated to twenty-two. RULED 2026-09-11 (Michael): the
# folder name is the address's and never the taxonomy's; it is removed here.
#
# post_init is the moment: it fires after categories_from_path has set the
# folder name and before the front matter is read, and Document#merge_categories!
# unions the front matter's list with whatever this leaves, so a post's own
# categories arrive intact and the folder's does not. A hand-authored post
# with no categories at all gets an empty list, which the layout treats as
# absent. Runs in the Actions build; the Pages plugin whitelist does not
# govern that build (_config.yml, Plugins).
Jekyll::Hooks.register :posts, :post_init do |post|
  cats = post.data["categories"]
  post.data["categories"] = cats - ["weblog"] if cats.is_a?(Array)
end
