var stripIndent = require('strip-indent');
var MarkdownIt = require('markdown-it');
var highlight = require('highlight.js');
var repeating = require('repeating');
var debounce = require('debounce');
var mkdirp = require('mkdirp');
var extend = require('extend');
var watchr = require('watchr');
var async = require('async');
var path = require('path');
var less = require('less');
var dox = require('dox');
var ejs = require('ejs');
var toc = require('toc');
var fs = require('fs');

var languages = require('./languages');

var md = new MarkdownIt({
  html: true,
  langPrefix: '',
  highlight: function (str, lang) {
    if (lang && highlight.getLanguage(lang)) {
      try {
        return highlight.highlight(lang, str).value;
      } catch (__) {}
    }

    return ''; // use external default escaping
  }
});

var Docker = module.exports = function(opts){
  opts = this.options = extend({
    inDir: path.resolve('.'),
    outDir: path.resolve('doc'),
    onlyUpdated: false,
    colourScheme: 'default',
    ignoreHidden: false,
    sidebarState: true,
    exclude: false,
    lineNums: false,
    multiLineOnly: false,
    js: [],
    css: [],
    extras: []
  }, opts);

  if(typeof opts.exclude === 'string'){
    this.excludePattern = new RegExp('^(' +
      opts.exclude.replace(/\./g, '\\.')
                  .replace(/\*/g, '.*')
                  .replace(/,/g, '|') +
      ')(/|$)');
  }else{
    this.excludePattern = false;
  }

  this.tree = {};

  var extrasRoot = path.resolve(__dirname, '..', 'extras');

  opts.extras.forEach(function(e){
    opts.js.push(path.join(extrasRoot, e, e + '.js'));
    opts.css.push(path.join(extrasRoot, e, e + '.css'));
  });
};

Docker.prototype.doc = function(files){
  this.files = files.concat();
  if(!this.running) this.run();
};

/**
 * ## Docker.prototype.watch
 *
 * Watches the input directory for file changes and updates docs whenever a file is updated
 *
 * @param {Array} files Array of file paths relative to the `inDir` to generate documentation for.
 */
Docker.prototype.watch = function(files){
  this.watching = true;
  this.watchFiles = files;

  // Function to call when a file is changed. We put this on a timeout to account
  // for several file changes happening in quick succession.
  var uto = false, self = this;
  function update(){
    if(self.running) return (uto = setTimeout(update, 250));
    self.doc(self.watchFiles);
    uto = false;
  }

  watchr.watch({
    path: this.options.inDir,
    listener: function(){
      if(!uto) uto = setTimeout(update, 250);
    }
  });

  // Aaaaand, go!
  this.doc(files);
};

Docker.prototype.run = function(){
  var self = this;
  this.running = true;
  async.whilst(
    function(){ return self.files.length > 0; },
    function(cb){
      self.process(self.files.shift(), cb);
    },
    function(){
      self.running = false;
      self.copySharedResources();
    }
  );
};

Docker.prototype.process = function(file, cb){

  if(this.excludePattern && this.excludePattern.test(file)){
    cb();
    return;
  }

  var self = this;

  var resolved = path.resolve(this.options.inDir, file);
  fs.lstat(resolved, function lstatCb(err, stat){
    if(err) return cb(err);

    if(stat && stat.isSymbolicLink()){
      fs.readlink(resolved, function(err, link){
        if(err) return cb(err);

        resolved = path.resolve(path.dirname(resolved), link);

        fs.exists(resolved, function(exists){
          if(!exists){
            // TODO nice error
            cb(null);
          }else{
            fs.lstat(resolved, lstatCb);
          }
        });
      });
    }else if(stat && stat.isDirectory()){
      fs.readdir(resolved, function(err, list){
        if(err) return cb(err);

        list.forEach(function(f){
          if(self.options.ignoreHidden && f.charAt(0).match(/[\._]/)) return;
          self.files.push(path.join(file, f));
        });
        cb();
      });
    }else{
      self.processFile(file, cb);
    }
  });
};

Docker.prototype.processFile = function(file, cb){
  var resolved = path.resolve(this.options.inDir, file);
  var self = this;

  this.decideWhetherToProcess(resolved, function(shouldProcess){
    if(!shouldProcess) return cb();

    fs.readFile(resolved, 'utf-8', function(err, data){
      if(err) return cb(err);

      var lang = self.detectLanguage(resolved, data);
      if(lang === false) return cb();

      self.addFileToTree(file);

      switch(lang.type){
        case 'markdown':
          self.renderMarkdownFile(data, resolved, cb);
          break;
        default:
        case 'code':
          var sections = self.parseSections(data, lang);
          self.highlight(sections, lang);
          self.renderCodeFile(sections, lang, resolved, cb);
          break;
      }
    });
  });
};

/**
 * ## Docker.prototype.decideWhetherToProcess
 *
 * Decide whether or not a file should be processed. If the `onlyUpdated`
 * flag was set on initialization, only allow processing of files that
 * are newer than their counterpart generated doc file.
 *
 * Fires a callback function with either true or false depending on whether
 * or not the file should be processed
 *
 * @param {string} filename The name of the file to check
 * @param {function} callback Callback function
 */
Docker.prototype.decideWhetherToProcess = function(filename, callback){

  // If we should be processing all files, then yes, we should process this one
  if(!this.options.onlyUpdated) return callback(true);

  // Find the doc this file would be compiled to
  var outFile = this.outFile(filename);

  // See whether the file is newer than the output
  this.fileIsNewer(filename, outFile, callback);
};

/**
 * ## Docker.prototype.fileIsNewer
 *
 * Sees whether one file is newer than another
 *
 * @param {string} file File to check
 * @param {string} otherFile File to compare to
 * @param {function} callback Callback to fire with true if file is newer than otherFile
 */
Docker.prototype.fileIsNewer = function(file, otherFile, callback){
  fs.stat(otherFile, function(err, outStat){

    // If the output file doesn't exist, then definitely process this file
    if(err && err.code == 'ENOENT') return callback(true);

    fs.stat(file, function(err, inStat){
      // Process the file if the input is newer than the output
      callback(+inStat.mtime > +outStat.mtime);
    });
  });
};


Docker.prototype.addFileToTree = function(filename){
  // Split the file's path into the individual directories
  filename = filename.replace(new RegExp('^' + path.sep.replace(/([\/\\])/g, '\\$1')), '');
  var bits = filename.split(path.sep);

  // Loop through all the directories and process the folder structure into `this.tree`.
  //
  // `this.tree` takes the format:
  // ```js
  //  {
  //    dirs: {
  //      'child_dir_name': { /* same format as tree */ },
  //      'other_child_name': // etc...
  //    },
  //    files: [
  //      'filename.js',
  //      'filename2.js',
  //      // etc...
  //    ]
  //  }
  // ```
  var currDir = this.tree;
  var lastBit = bits.pop();

  bits.forEach(function(bit){
    if(!currDir.dirs) currDir.dirs = {};
    if(!currDir.dirs[bit]) currDir.dirs[bit] = {};
    currDir = currDir.dirs[bit];
  });
  if(!currDir.files) currDir.files = [];

  var lastBit = bits[bits.length - 1];

  if(currDir.files.indexOf(lastBit) === -1) currDir.files.push(lastBit);
};


Docker.prototype.detectLanguage = function(filename, contents){

  // First try to detect the language from the file extension
  var ext = path.extname(filename);
  ext = ext.replace(/^\./, '');

  // Bit of a hacky way of incorporating .C for C++
  if(ext === '.C') return languages.cpp;
  ext = ext.toLowerCase();

  var base = path.basename(filename);
  base = base.toLowerCase();

  for(var i in languages){
    if(!languages.hasOwnProperty(i)) continue;
    if(languages[i].extensions &&
      languages[i].extensions.indexOf(ext) !== -1) return languages[i];
    if(languages[i].names &&
      languages[i].names.indexOf(base) !== -1) return languages[i];
  }

  // If that doesn't work, see if we can grab a shebang

  var shebangRegex = /^\n*#!\s*(?:\/usr\/bin\/env)?\s*(?:[^\n]*\/)*([^\/\n]+)(?:\n|$)/;
  var match = shebangRegex.exec(contents);
  if(match){
    for(var j in languages){
      if(!languages.hasOwnProperty(j)) continue;
      if(languages[j].executables && languages[j].executables.indexOf(match[1]) !== -1) return languages[j];
    }
  }

  // If we still can't figure it out, give up and return false.
  return false;
};

Docker.prototype.renderMarkdownFile = function(data, filename, cb){
  var content = md.render(data);

  var headings = { ids: {}, list: [] };

  // Add anchors to all headings
  content = this.addAnchors(content,0, headings);

  // Wrap up with necessary classes
  content = '<div class="docs markdown">' + content + '</div>';

  this.makeOutputFile(filename, content, headings, cb);
};

Docker.prototype.parseSections = function(data, lang){
  var lines = data.split('\n');

  var section = {
    docs: '',
    code: ''
  };

  var sections = [];

  var inMultiLineComment = false;
  var multiLine = '';
  var jsDocData;

  var commentRegex = new RegExp('^\\s*' + lang.comment + '\\s?');

  var self = this;


  function mark(a, stripParas){
    var h = md.render(a.replace(/(^\s*|\s*$)/,''));
    return stripParas ? h.replace(/<\/?p>/g,'') : h;
  }

  lines.forEach(function(line, i){

    // Only match against parts of the line that don't appear in strings
    var matchable = line.replace(/(["'])((?:[^\\\1]|(?:\\\\)*?\\[^\\])*?)\1/g,'$1$1');
    if(lang.literals) {
      lang.literals.forEach(function(replace){
        matchable = matchable.replace(replace[0], replace[1]);
      });
    }

    if(lang.multiLine){
      // If we are currently in a multiline comment, behave differently
      if(inMultiLineComment){

        // End-multiline comments should match regardless of whether they're 'quoted'
        if(line.match(lang.multiLine[1])){
          // Once we have reached the end of the multiline, take the whole content
          // of the multiline comment, and parse it as jsDoc.
          inMultiLineComment = false;

          multiLine += line;

          // Replace block comment delimiters with whitespace of the same length
          // This way we can safely outdent without breaking too many things if the
          // comment has been deliberately indented. For example, the lines in the
          // followinc comment should all be outdented equally:
          //
          // ```c
          //    /* A big long multiline
          //       comment that should get
          //       outdented properly       */
          // ```
          multiLine = multiLine
            .replace(lang.multiLine[0], function(a){ return repeating(' ', a.length); })
            .replace(lang.multiLine[1], function(a){ return repeating(' ', a.length); });

          multiLine = stripIndent(multiLine);

          if(lang.jsDoc){

            // Strip off leading * characters.
            multiLine = multiLine.replace(/^[ \t]*\*? ?/gm, '');

            jsDocData = dox.parseComment(multiLine, { raw: true });

            // Put markdown parser on the data so it can be accessed in the template
            jsDocData.md = mark;
            section.docs += self.renderTemplate('jsDoc', jsDocData);
          }else{
            section.docs += '\n' + multiLine + '\n';
          }
          multiLine = '';
        }else{
          multiLine += line + '\n';
        }
        return;
      }else if(
        // We want to match the start of a multiline comment only if the line doesn't also match the
        // end of the same comment, or if a single-line comment is started before the multiline
        // So for example the following would not be treated as a multiline starter:
        // ```js
        // alert('foo'); // Alert some foo /* Random open comment thing
        // ```
        matchable.match(lang.multiLine[0]) &&
        !matchable.replace(lang.multiLine[0],'').match(lang.multiLine[1]) &&
        (!lang.comment || !matchable.split(lang.multiLine[0])[0].match(commentRegex))
      ){
        // Here we start parsing a multiline comment. Store away the current section and start a new one
        if(section.code){
          if(!section.code.match(/^\s*$/) || !section.docs.match(/^\s*$/)) sections.push(section);
          section = { docs: '', code: '' };
        }
        inMultiLineComment = true;
        multiLine = line + '\n';
        return;
      }
    }
    if(
      !self.options.multiLineOnly &&
      lang.comment &&
      matchable.match(commentRegex) &&
      (!lang.commentsIgnore || !matchable.match(lang.commentsIgnore)) &&
      !matchable.match(/#!/)
    ){
      // This is for single-line comments. Again, store away the last section and start a new one
      if(section.code){
        if(!section.code.match(/^\s*$/) || !section.docs.match(/^\s*$/)) sections.push(section);
        section = { docs: '', code: '' };
      }
      section.docs += line.replace(commentRegex, '') + '\n';
    }else if(!lang.commentsIgnore || !line.match(lang.commentsIgnore)){

      // If this is the first line of active code, store it in the section
      // so we can grab it for line numbers later
      if(!section.firstCodeLine){
        section.firstCodeLine = i + 1;
      }
      section.code += line + '\n';
    }
  });

  sections.push(section);
  return sections;
};

Docker.prototype.highlight = function(sections, lang){
  sections.forEach(function(section){
    section.codeHtml = highlight.highlight(lang.language, section.code).value;
    section.docHtml = md.render(section.docs);
  });
};

Docker.prototype.renderCodeFile = function(sections, language, filename, cb){
  var self = this;

  var headings = { ids: {}, list: [] };

  sections.forEach(function(section, i){
    section.docHtml = self.addAnchors(section.docHtml, i, headings);

    if(self.options.lineNums){
      section.codeHtml = self.addLineNumbers(section.codeHtml, section.firstCodeLine);
    }
  });

  var content = this.renderTemplate('code', {
    title: path.basename(filename),
    sections: sections,
    language: language.language
  });

  this.makeOutputFile(filename, content, headings, cb);
};

Docker.prototype.makeOutputFile = function(filename, content, headings, cb){

  // Decide which path to store the output on.
  var outFile = this.outFile(filename);

  // Calculate the location of the input root relative to the output file.
  // This is necessary so we can link to the stylesheet in the output HTML using
  // a relative href rather than an absolute one
  var outDir = path.dirname(outFile);
  var relativeOut = path.resolve(outDir)
                      .replace(path.resolve(this.options.outDir),'')
                      .replace(/^[\/\\]/,'');
  var levels = relativeOut == '' ? 0 : relativeOut.split(path.sep).length;
  var relDir = repeating('../', levels);

  // Render the html file using our template
  var html = this.renderTemplate('tmpl', {
    title: path.basename(filename),
    relativeDir: relDir,
    content: content,
    headings: headings,
    sidebar: this.options.sidebarState,
    filename: filename.replace(this.options.inDir,'').replace(/^[\\\/]/,''),
    js: this.options.js.map(function(f){ return path.basename(f); }),
    css: this.options.css.map(function(f){ return path.basename(f); })
  });

  // Recursively create the output directory, clean out any old version of the
  // output file, then save our new file.
  this.writeFile(outFile, html, 'Generated: ' + outFile.replace(this.options.outDir, ''), cb);
};

Docker.prototype.renderTemplate = function(templateName, obj){
  if(!this._templates) this._templates = {};
  if(!this._templates[templateName]){
    var tmplFile = path.join(__dirname, '..', 'res', templateName + '.ejs');
    this._templates[templateName] = ejs.compile(fs.readFileSync(tmplFile).toString());
  }
  return this._templates[templateName](obj);
};

Docker.prototype.outFile = function(filename){
  return path.normalize(filename.replace(path.resolve(this.options.inDir), this.options.outDir) + '.html');
};

Docker.prototype.writeFile = function(filename, fileContent, doneLog, doneCallback){
  mkdirp(path.dirname(filename), function(){
    fs.writeFile(filename, fileContent, function(){
      if(doneLog) console.log(doneLog);
      if(doneCallback) doneCallback();
    });
  });
};

Docker.prototype.copySharedResources = function(){
  var self = this;
  self.writeFile(
    path.join(self.options.outDir, 'doc-filelist.js'),
    'var tree=' + JSON.stringify(self.tree) + ';',
    'Saved file tree to doc-filelist.js'
  );

  fs.readFile(path.join(__dirname, '..', 'res', 'style.less'), function(err, file){
    var hlpath = require.resolve('highlight.js');
    var cspath = path.resolve(path.dirname(hlpath), '..', 'styles');
    var colours = require('./getColourScheme')(self.options.colourScheme);
    less.render(file.toString().replace('COLOURSCHEME', self.options.colourScheme), {
      paths: [cspath],
      globalVars: colours
    }, function(err, out){
      self.writeFile(
        path.join(self.options.outDir, 'doc-style.css'),
        out.css,
        'Compiled CSS to doc-style.css'
      );
    });
  });

  fs.readFile(path.join(__dirname, '..', 'res', 'script.js'), function(err, file){
    self.writeFile(
      path.join(self.options.outDir, 'doc-script.js'),
      file,
      'Copied JS to doc-script.js'
    );
  });

  this.options.js.concat(this.options.css).forEach(function(ext){
    var fn = path.basename(ext);
    fs.readFile(path.resolve(ext), function(err, file){
      self.writeFile(path.join(self.options.outDir, fn), file, 'Copied ' + fn);
    });
  });
};

Docker.prototype.addAnchors = function(docHtml, idx, headings){
  var headingRegex = /<h(\d)(\s*[^>]*)>([\s\S]+?)<\/h\1>/gi; // toc.defaults.headers

  if(docHtml.match(headingRegex)){
    // If there is a heading tag, pick out the first one (likely the most important), sanitize
    // the name a bit to make it more friendly for IDs, then use that
    docHtml = docHtml.replace(headingRegex, function(a, level, attrs, content){
      var id = toc.unique(headings.ids, toc.anchor(content));

      headings.list.push({ id: id, text: toc.untag(content), level: level });
      return [
        '<div class="pilwrap" id="' + id + '">',
        '  <h' + level + attrs + '>',
        '    <a href="#' + id + '" name="' + id + '" class="pilcrow"></a>',
             content,
        '  </h' + level + '>',
        '</div>'
      ].join('\n');
    });
  }else{
    // If however we can't find a heading, then just use the section index instead.
    docHtml = [
      '<div class="pilwrap">',
      '  <a class="pilcrow" href="#section-' + (idx + 1) + '" id="section-' + (idx + 1) + '"></a>',
      '</div>',
      docHtml
    ].join('\n');
  }
  return docHtml;
};

Docker.prototype.addLineNumbers = function(html, first){
  var lines = html.split('\n');

  lines = lines.map(function(line, i){
    var n = first + i;
    return '<a class="line-num" href="#line-' + n + '" id="line-' + n + '" data-line="' + n + '"></a>  ' + line;
  });

  return lines.join('\n');
};
