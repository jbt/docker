var jumpBoxShown = false;
var jumpTimeout;

function jumpFormKeyDown(e){
  e = e || window.event;
  if(e.keyCode == 27){
    document.body.removeChild(document.getElementById('jumpto'));
    jumpBoxShown = false;
  }else{
    clearTimeout(jumpTimeout);
    jumpTimeout = setTimeout(doJump, 150);
  }
}

function addEvent(obj, evt, func, a){
  if((a = obj.addEventListener)){
    a.call(obj, evt, func, false);
  }else{
    obj.attachEvent('on' + evt, func);
  }
}

function jumpFormSubmitted(e){
  e = e || window.event;
  e.preventDefault();

  doJump();

  document.body.removeChild(document.getElementById('jumpto'));
  jumpBoxShown = false;

  return false;
}

function doJump(){
  if(!jumpBoxShown) return;

  var line = document.getElementById('jumpbox').value;

  var theLine = document.getElementById('line-' + line);

  if(!theLine) return;

  window.location.hash = 'line-' + line;
}

function showJumpBox(){
  if(jumpBoxShown) return;
  jumpBoxShown = true;

  var f = document.createElement('div');

  f.id = "jumpto";

  f.innerHTML = [
    '<div class="overlay"></div>',
    '<div class="box">',
      '<form id="jumpform">',
        '<input id="jumpbox" type="text" name="line" placeholder="Go to line..." autocomplete="off" />',
      '</form>',
    '</div>'
  ].join('');

  addEvent(f, 'keydown', jumpFormKeyDown);

  document.body.appendChild(f);

  document.getElementById('jumpbox').focus();
  addEvent(document.getElementById('jumpform'), 'submit', jumpFormSubmitted);

}

function goToLine_kd(e){
  e = e || window.event;
  if(e.keyCode === 71 && (e.ctrlKey || e.metaKey)){
    showJumpBox();
    e.preventDefault();
    return false;
  }
}

addEvent(document, 'keydown', goToLine_kd);
