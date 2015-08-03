var path = require('path');
var css = require('css');
var fs = require('fs');

var hlpath = require.resolve('highlight.js');
var cspath = path.resolve(path.dirname(hlpath), '..', 'styles');

function flattenRules(rules){
  var out = {};

  rules.forEach(function(rule){
    if(rule.type !== 'rule') return;
    rule.selectors.forEach(function(sel){
      if(!out[sel]) out[sel] = {};

      rule.declarations.forEach(function(decl){
        out[sel][decl.property] = decl.value;
      });
    });
  });

  return out;
}

module.exports = function(cs){
  var file = path.join(cspath, cs + '.css');
  var ast = css.parse(fs.readFileSync(file).toString());

  var rules = flattenRules(ast.stylesheet.rules);

  var base = rules['.hljs'];

  var fg = base.color || 'black';
  var bg = base.background || '#fff';

  var comment = rules['.hljs-comment'] || {};
  var commentColour = comment.color || '#888';

  var number = rules['.hljs-number'] || rules['.javascript .hljs-number'] || {};
  var numberCol = number.color || '#261a3b';

  return { fg: fg, bg: bg, comment: commentColour, link: numberCol };
};
