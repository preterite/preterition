-- verse-lines.lua -- for meaning-functionless-dialogue.md
--
-- With -f markdown+hard_line_breaks a whole speech arrives as one paragraph
-- with LineBreaks between verse lines. This filter restructures each speech
-- into a two-part block:
--
--   <div class="speech">
--     <div class="cue"><strong>NAME</strong></div>
--     <div class="lines">
--       <div class="keep"><div class="line">...</div> ...</div>   first HEAD
--       <div class="line">...</div> ...                           interior
--       <div class="keep"><div class="line">...</div> ...</div>   last TAIL
--     </div>
--   </div>
--
-- so the stylesheet can set the cue right-aligned in a left column and the
-- verse left-aligned in a right column, each verse line independently
-- indentable for turn-overs. Single-line paragraphs (the Setting) are left
-- alone.

local function is_speaker(inlines)
  return #inlines == 1 and inlines[1].t == "Strong"
end

function Para(el)
  local lines, cur = {}, {}
  for _, inl in ipairs(el.content) do
    if inl.t == "LineBreak" then
      lines[#lines + 1] = cur; cur = {}
    else
      cur[#cur + 1] = inl
    end
  end
  lines[#lines + 1] = cur

  if #lines < 2 then return nil end

  local cue, body = nil, {}
  for _, ln in ipairs(lines) do
    if #ln > 0 then
      if cue == nil and is_speaker(ln) then
        cue = pandoc.Div({ pandoc.Plain(ln) }, pandoc.Attr("", {"cue"}))
      else
        body[#body + 1] =
          pandoc.Div({ pandoc.Plain(ln) }, pandoc.Attr("", {"line"}))
      end
    end
  end

  -- Keep groups. A speech of WHOLE lines or fewer is unbreakable entire; a
  -- longer one breaks freely in its interior, but its first HEAD lines and
  -- its last TAIL lines each travel together, so no page boundary strands
  -- fewer than TAIL lines at a foot or HEAD lines at a head. The stylesheet
  -- puts break-inside: avoid on .keep alone, never on .speech or .lines.
  local HEAD, TAIL, WHOLE = 2, 2, 5
  local function keep(ds) return pandoc.Div(ds, pandoc.Attr("", {"keep"})) end

  local grouped = {}
  if #body <= WHOLE then
    grouped[1] = keep(body)
  else
    local head, mid, tail = {}, {}, {}
    for i, d in ipairs(body) do
      if i <= HEAD then head[#head + 1] = d
      elseif i > #body - TAIL then tail[#tail + 1] = d
      else mid[#mid + 1] = d end
    end
    grouped[#grouped + 1] = keep(head)
    for _, d in ipairs(mid) do grouped[#grouped + 1] = d end
    grouped[#grouped + 1] = keep(tail)
  end

  local kids = {}
  if cue then kids[#kids + 1] = cue end
  kids[#kids + 1] = pandoc.Div(grouped, pandoc.Attr("", {"lines"}))
  return pandoc.Div(kids, pandoc.Attr("", {"speech"}))
end
