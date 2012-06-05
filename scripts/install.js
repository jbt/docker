var os = require('os');

if(os.platform().substring(0,3) == "win"){
  console.log("Remember to install Pygments for docker to work.");
  console.log("Check out http://pygments.org/ for instructions how to do this.");
}else{
  require('child_process').exec('sh scripts/install.sh');
}