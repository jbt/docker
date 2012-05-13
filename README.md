# Docker

A documentation generator built on the foundations of [Docco](http://jashkenas.github.com/docco/) and [Docco-Husky](https://github.com/mbrevoort/docco-husky).

The support available in Docco and Docco-Husky for larger projects consisting of many hundreds of script files was somewhat lacking, so I decided to create my own.

Take a look at this project's [public page](http://jbt.github.com/docker) for an example of what it can do.

## Installation

Simple: `npm install -g docker`

Requires [Pygments](http://pygments.org/)

## Usage

```sh
$ docker [options] [files ...]
```

Available options are:

 * `-i` or `--input_dir`: Path to input source directory. Defaults to current directory.
 * `-o` or `--output_dir`: Path to output doc directory. Defaults to `./doc`.
 * `-u` or `--updated_files`: If present, only process files that hav been changed.
 * `-c` or `--colour_scheme` (yes, I'm British): Colour scheme to use. Colour schemes are as below.
 * `-I` or `--ignore_hidden`: Ignore files and directories whose names begin with `.` or `_`.
 * `-w` or `--watch`: Keep the process running, watch for changes on the directory, and process updated files.

If no file list is given, docker will run recursively on every file in the current directory

Any of the files given can also be directories, in which case it will recurse into them.

Folder structure inside the input directory is preserved into the output directory and file names are simply appended `.html` for the doc file

## Examples

If you haven't installed with `-g` specified, replace `docker` with something like `$(npm root)/docker/docker` in all of the examples below.

### Process every file in the current directory into "doc"

```sh
$ docker
```

### Process files in "src" to "documents"

```sh
$ docker -i src -o documents
```
or:
```sh
$ docker -o documents src
```
or:
```sh
$ docker -o documents src/*
```

Note that in the first example, the contents of `src` will be mapped directly into `documents` whereas in the second and third
examples, the files will be created inside `documents/src`

### Generate Docker docs

This is the command I use to generate [this project's documentation](http://jbt.github.com/docker).

 * Output to a directory on the `gh-pages` branch of this repo
 * Use the "manni" colour scheme
 * Ignore files starting with `_` or `.`
 * Only process updated files
   * The coffee-script parser in one of the `node_modules` dirs is huge, so definitely don't process that every time
 * Watch the directory for further changes as the code is updated.

```sh
$ docker -o ../docker_gh-pages -c manni -I -u --watch
```


## Colour Schemes

These are exactly as in `pygmentize -L styles`:

 * monokai
 * manni
 * rrt
 * perldoc
 * borland
 * colorful
 * default
 * murphy
 * vs
 * trac
 * tango
 * fruity
 * autumn
 * bw
 * emacs
 * vim
 * pastie
 * friendly
 * native


## Important note

All files must be inside the input directory (specified by `-i`) or one of its descendant subdirectories. If they're not then it'll just get horribly confused and get into an infinite loop. Which isn't nice.