var mkdirp = require('mkdirp'),
  fs = require('fs'),
  dox = require('dox'),
  path = require('path'),
  spawn = require('child_process').spawn,
  showdown = require('../lib/showdown').Showdown;

var Docker = module.exports =function(inDir, outDir){
  this.inDir = inDir.replace(/\/$/,'');
  this.outDir = outDir;
  this.running = false;
  this.fileQueue = [];
};

Docker.prototype.doc = function(files){
  for(var i = 0; i < files.length; i += 1){
    this.docFile(files[i]);
  }
};

Docker.prototype.docFile = function(filename){
  var self = this;
  fs.stat(path.join(this.inDir, filename), function(err, stat){
    if(stat && stat.isDirectory()){
      fs.readdir(path.join(self.inDir, filename), function(err, list){
        var files = [];
        for(var i = 0; i < list.length; i += 1){
          files.push(path.join(filename, list[i]));
        }
        self.doc(files);
      });
    }else{
      self.queueFile(filename);
    }
  })
};

Docker.prototype.queueFile = function(filename){
  if(!this.canHandleFile(filename)) return;
  this.fileQueue.push(filename);
  if(!this.running) this.nextFile();
};

Docker.prototype.nextFile = function(){
  var self = this;
  if(this.fileQueue.length > 0){
    this.generateDoc(this.fileQueue.shift(), function(){
      self.nextFile();
    })
  }else{
    this.running = false;
  }
};

Docker.prototype.canHandleFile = function(filename){
  return path.extname(filename) == '.js';
}

Docker.prototype.generateDoc = function(filename, cb){
  var self = this;
  this.running = true;
  filename = path.join(this.inDir, filename);
  fs.readFile(filename, 'utf-8', function(err, data){
    if(err) throw err;
    var sections = self.parseSections(data, filename);
    self.highlight(sections, filename, function(){
      self.renderHtml(sections, filename, cb);
    });
  })
};

Docker.prototype.parseSections = function(data, filename){
  var codeLines = data.split('\n');
  var sections = [];
  var params = this.languageParams(filename);
  var section = {
    docs: '',
    code: ''
  };
  var inMultiLineComment = false;
  var multiLine = '';
  for(var i = 0; i < codeLines.length; i += 1){
    var line = codeLines[i];
    if(inMultiLineComment){
      if(line.match(params.multilineEnd)){
        multiLine += line + '\n';
        inMultiLineComment = false;
        try{
          var data = dox.parseComments(multiLine)[0];
          section.docs += this.doxTemplate(data);
        }catch(e){
          console.log("Dox error: " + e);
          section.docs += multiLine
        }
        multiLine = '';
      }else{
        multiLine += line + '\n';
      }
    }else if(line.match(params.multilineStart) && !line.match(params.multilineEnd)){
      if(section.code){
        if(!section.code.match(/^\s*$/) || !section.docs.match(/^\s*$/)) sections.push(section);
        section = { docs: '', code: '' };
      }
      inMultiLineComment = true;
      multiLine = line;
    }else if(line.match(params.commentRegex) && !line.match(params.commentsIgnore)){
      if(section.code){
        if(!section.code.match(/^\s*$/) || !section.docs.match(/^\s*$/)) sections.push(section);
        section = { docs: '', code: '' };
      }
      section.docs += line.replace(params.commentRegex, '') + '\n';
    }else if(!line.match(params.commentsIgnore)){
      section.code += line + '\n';
    }
  }
  sections.push(section);
  return sections;
};

Docker.prototype.languageParams = function(filename){
  switch(path.extname(filename)){
    case '.js':
      return {
        name: 'javascript',
        comment: '//',
        commentRegex: /^\s*\/\/\s?/,
        commentsIgnore: /^\s*\/\/=/,
        multilineStart: /\/\*/,
        multilineEnd: /\*\//,
        divText: '\n//----{DIVIDER_THING}----\n',
        divHtml: /\n*<span class="c1?">\/\/----\{DIVIDER_THING\}----<\/span>\n*/
      }
    default:
      throw 'Unknown language';
  }
}

Docker.prototype.highlight = function(sections, filename, cb){
  var params = this.languageParams(filename);

  var pyg = spawn('pygmentize', ['-l', params.name, '-f', 'html', '-O', 'encoding=utf-8,tabsize=2']);

  pyg.stderr.on('data', function(err){ console.error(err) });
  pyg.stdin.on('error', function(err){
    console.error('Unable to write to Pygments stdin: ' , err)
    process.exit(1);
  });

  var out = '';
  pyg.stdout.on('data', function(data){ out += data.toString() });

  pyg.on('exit', function(){
    out = out.replace(/^\s*<div class="highlight"><pre>/,'').replace(/<\/pre><\/div>\s*$/,'');
    var bits = out.split(params.divHtml);
    for(var i = 0; i < sections.length; i += 1){
      sections[i].codeHtml = '<div class="highlight"><pre>' + bits[i] + '</pre></div>';
      sections[i].docHtml = showdown.makeHtml(sections[i].docs);
    }
    cb();
  })

  if(pyg.stdin.writable){
    var input = [];
    for(var i = 0; i < sections.length; i += 1){
      input.push(sections[i].code);
    }
    pyg.stdin.write(input.join(params.divText));
    pyg.stdin.end();
  }
};

Docker.prototype.renderHtml = function(sections, filename, cb){

  var outFile = this.outFile(filename);
  var outDir = path.dirname(outFile); 
  var relDir = '';
  while(path.join(outDir, relDir).replace(/\/$/,'') !== this.outDir.replace(/\/$/,'')){
    relDir += '../';
  }

  var html = this.renderTemplate({
    title: path.basename(filename),
    sections: sections,
    relativeDir: relDir
  });


  mkdirp(outDir, function(){
    fs.unlink(outFile, function(){
      fs.writeFile(outFile, html, function(){
        console.log(outFile.replace(self.outDir,''));
        cb();
      });
    });
  });

  var self= this;

  fs.stat(path.join(this.outDir, '_doc-style.css'), function(err, stat){
    if(err){
      fs.readFile(path.join(path.dirname(__filename),'../res/style.css'), function(err, file){
        fs.writeFile(path.join(self.outDir, '_doc-style.css'), file);
      })
    }
  })
};

Docker.prototype.outFile = function(filename){
  return filename.replace(this.inDir, this.outDir) + '.html';
};

Docker.prototype.compileTemplate = function(str){
  return new Function('obj', 'var p=[],print=function(){p.push.apply(p,arguments);};'
    + 'with(obj){p.push(\'' 
    + str.replace(/[\r\t\n]/g, " ")
         .replace(/'(?=[^<]*%>)/g, "\t")
         .split("'").join("\\'")
         .split("\t").join("'")
         .replace(/<%=(.+?)%>/g, "',$1,'")
         .split('<%').join("');")
         .split('%>').join("p.push('")
    + "');}return p.join('');");
};

Docker.prototype.renderTemplate = function(obj){
  if(!this.__tmpl){
    var tmplFile = path.join(path.dirname(__filename),'../res/tmpl.jst');
    this.__tmpl = this.compileTemplate(fs.readFileSync(tmplFile).toString());
  }
  return this.__tmpl(obj);
}

Docker.prototype.doxTemplate = function(obj){
  if(!this.__doxtmpl){
    var tmplFile = path.join(path.dirname(__filename), '../res/dox.jst');
    this.__doxtmpl = this.compileTemplate(fs.readFileSync(tmplFile).toString());
  }
  return this.__doxtmpl(obj);
}