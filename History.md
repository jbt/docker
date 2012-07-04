# Docker Version History

## 0.1.2

 * Windows compatibility
 * Resolve infinite loop problem when files aren't actually inside the source dir
 * A few minor typos

## 0.1.1

 * Fixed problem with commend delimiters being matched inside string literals

## 0.1.0

 * Added `-w` flag to watch a directory for changes (experimental). Not sure how useful it'll actually be, but it's cool.
 * Added `-I` switch to ignore hidden files
 * Fixed some rendering bugs for code blocks
 * Added automatic title generation for empty-looking files
 * Various styling tweaks

## 0.0.9

 * Added support for another pile more languages (added perl, php, actionscript, sh and yaml)
 * Ran embedded arrow images through pngcrush.  Saved a load of bytes

## 0.0.8

 * Added support for different colour schemes
 * A few more improvements to showdown for GFM-style bits.

## 0.0.7

 * Minor improvements to code structure
 * Full comments on public script file

## 0.0.6

 * Added support for a pile more languages (now JS, coffeescript, ruby, python, C, C++, C#, Java and Markdown)
 * Tweaks to markdown (particularly, automatic linking of URLs and email addresses)

## 0.0.5

 * Added heading navigation within files

## 0.0.4

 * Added syntax highlighting to fenced code blocks that have a language specified

## 0.0.3

 * Minor improvements to store the scroll position of the folder tree

## 0.0.2

 * Added `-u` flag to only process files that have been updated

## 0.0.1

Initial version indcluded (among other things):

 * Folder tree
 * Syntax highlighting of javascript files
 * Markdown processing of `.md` files and extracted code comments
