// https://github.com/ghiculescu/jekyll-table-of-contents

(function($){
$.fn.JekyllToc = function(options) {
  var defaults = {
    text: 'Jump to...',
    list_type: 'ol',
    no_back_to_top_links: false
  },
  settings = $.extend(defaults, options);

  var headers = $('h1, h2, h3, h4, h5, h6').filter(function() {return this.id}), // get all headers with an ID
      output = $('.toc');
  if (!headers.length || headers.length < 3 || !output.length)
    return;

  var get_level = function(ele) { return parseInt(ele.nodeName.replace("H", ""), 10) }
  var highest_level = headers.map(function(_, ele) { return get_level(ele) }).get().sort()[0]
  var return_to_top = '<i class="icon-arrow-up back-to-top"> </i>'

  var jump_text = "" !== $('.toc').html() ? $('.toc').html() : '<i>'+settings.text+'</i>';
  var level = get_level(headers[0]), this_level, html = jump_text + " <"+settings.list_type+">";
  headers.on('click', function() {
    if (!settings.no_back_to_top_links) window.location.hash = this.id
  }).addClass('clickable-header').each(function(_, header) {
    this_level = get_level(header);
    if (!settings.no_back_to_top_links && this_level === highest_level) {
      $(header).addClass('top-level-header').after(return_to_top)
    }
    if (this_level === level) // same level as before; same indenting
      html += "<li><a href='#" + header.id + "'>" + header.innerHTML + "</a>";
    else if (this_level < level) // higher level than before; end parent ol
      html += "</li></"+settings.list_type+"></li><li><a href='#" + header.id + "'>" + header.innerHTML + "</a>";
    else if (this_level > level) // lower level than before; expand the previous to contain a ol
      html += "<"+settings.list_type+"><li><a href='#" + header.id + "'>" + header.innerHTML + "</a>";
    level = this_level; // update for the next one
  });
  html += "</"+settings.list_type+">";
  if (!settings.no_back_to_top_links) {
    $(document).on('click', '.back-to-top', function() {
      $(window).scrollTop(0)
      window.location.hash = ''
    })
  }
  output.html(html);
};
})(jQuery);

$(document).ready(function() {
  $().JekyllToc({ list_type: 'ul' });
});