var os = require('os');

if(os.type().toLowerCase().substring(0,3) == "win"){
  console.log("Remember to install Pygments for docker to work.");
  console.log("Check out http://pygments.org/ for instructions how to do this.");
}else{
  var i = require('child_process').spawn('sh',['scripts/install.sh']);
  i.stdout.pipe(process.stdout, {end: false});
  process.stdin.resume();
  process.stdin.pipe(i.stdin, {end: false});
  i.on('exit', function(a){
    process.exit(a);
  });
}