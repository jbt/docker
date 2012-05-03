# Docker

A documentation generator built on the foundations of [Docco](http://jashkenas.github.com/docco/) and [Docco-Husky](https://github.com/mbrevoort/docco-husky).

The support available in Docco and Docco-Husky for larger projects consisting of many hundreds of script files was somewhat lacking, so I decided to create my own.

## Installation

Well, I may well even get this on npm at some point. Not yet though as it's such a WIP.

Requires [Pygments](http://pygments.org/)

## Usage

Still yet to finialise exactly how the command-line interface should work, but basically:

```
./docker -i root_source_dir -o root_doc_dir [file1 file2 file3 ...]
```

If the file list given is empty it'll just recurse into `root_source_dir` and run on anything it finds.

Any of the files given can also be directories, in which case it will recurse into them.

Folder structure inside `root_source_dir` is preserved into `root_doc_dir` and file names are simply appended `.html` for the doc file

### Important note

All files must be inside `root_source_dir` (or the current pwd if not specified) or one of its descendant subdirectories. If they're not then it'll just get horribly confused and get into an infinite loop. Which isn't nice.