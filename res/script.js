// # res/script.js
//
// This is the script file that gets copied into the output. It mainly manages the display
// of the folder tree. The idea of this script file is to be minimal and standalone. So
// that means no jQuery.

// Use localStorage to store data about the tree's state: whether or not
// the tree is visible and which directories are expanded
var treeVisible = (window.localStorage && window.localStorage.docker_showTree == 'yes');


/**
 * ## makeTree
 *
 * Consructs the folder tree view
 *
 * @param {object} treeData Folder structure as in [queueFile](../src/docker.js#docker.prototype.queuefile)
 * @param {string} root Path from current file to root (ie `'../../'` etc.)
 * @param {string} filename The current file name
 */
function makeTree(treeData, root, filename){
  var treeNode = document.getElementById('tree');
  var treeHandle = document.getElementById('tree-toggle');
  treeHandle.addEventListener('click', toggleTree, false);

  // Build the html and add it to the container.
  treeNode.innerHTML = nodeHtml('', treeData, '', root);

  // Root folder (whole tree) should always be open
  treeNode.childNodes[0].className += ' open';

  // Attach click evenr handler
  treeNode.addEventListener('click', nodeClicked, false);

  if(treeVisible) document.body.className += ' tree';

  // Only set a class to allow CSS transitions after the tree state has been painted
  setTimeout(function(){ document.body.className += ' slidey'; }, 100);
}

/**
 * # nodeClicked
 *
 * Called when a directory is clicked. Toggles open state of the directory
 *
 * @param {Event} e The click event
 */
function nodeClicked(e){

  // Find the target
  var t = e.target;

  // If the click target is actually a file (rather than a directory), ignore it
  if(t.tagName.toLowerCase() !== 'div' || t.className === 'children') return;

  // Recurse upwards until we find the actual directory node
  while(t && t.className.substring(0,3) != 'dir') t = t.parentNode;

  // If we're at the root node, then do nothing (we don't allow collapsing of the whole tree)
  if(!t || t.parentNode.id == 'tree') return;

  // Find the path and toggle the state, saving the state in the localStorage variable
  var path = t.getAttribute('rel');
  if(t.className.indexOf('open') !== -1){
    t.className=t.className.replace(/\s*open/g,'');
    if(window.localStorage) window.localStorage.removeItem('docker_openPath:' + path);
  }else{
    t.className += ' open';
    if(window.localStorage) window.localStorage['docker_openPath:' + path] = 'yes';
  }
}


/**
 * ## nodeHtml
 *
 * Constructs the markup for a directory in the tree
 *
 * @param {string} nodename The node name.
 * @param {object} node Node object of same format as whole tree.
 * @param {string} path The path form the base to this node
 * @param {string} root Relative path from current page to root
 */
function nodeHtml(nodename, node, path, root){
  // Firstly, figure out whether or not the directory is expanded from localStorage
  var isOpen = window.localStorage && window.localStorage['docker_openPath:' + path] == 'yes';
  var out = '<div class="dir' + (isOpen ? ' open' : '') + '" rel="' + path + '">';
  out += '<div class="nodename">' + nodename + '</div>';
  out += '<div class="children">';

  // Loop through all child directories first
  if(node.dirs){
    var dirs = [];
    for(var i in node.dirs){
      if(node.dirs.hasOwnProperty(i)) dirs.push({ name: i, html: nodeHtml(i, node.dirs[i], path + i + '/', root) });
    }
    // Have to store them in an array first and then sort them alphabetically here
    dirs.sort(function(a, b){ return (a.name > b.name) ? 1 : (a.name == b.name) ? 0 : -1; });

    for(var k = 0; k < dirs.length; k += 1) out += dirs[k].html;
  }

  // Now loop through all the child files alphabetically
  if(node.files){
    node.files.sort();
    for(var j = 0; j < node.files.length; j += 1){
      out += '<a class="file" href="' + root + path + node.files[j] + '.html">' + node.files[j] + '</a>';
    }
  }

  // Close things off
  out += '</div></div>';

  return out;
}

/**
 * ## toggleTree
 *
 * Toggles the visibility of the folder tree
 */
function toggleTree(){
  // Do the actual toggling by modifying the class on the body element. That way we can get some nice CSS transitions going.
  if(treeVisible){
    document.body.className = document.body.className.replace(/\s*tree/g,'');
    treeVisible = false;
  }else{
    document.body.className += ' tree';
    treeVisible = true;
  }
  if(window.localStorage){
    if(treeVisible){
      window.localStorage.docker_showTree = 'yes';
    }else{
      window.localStorage.removeItem('docker_showTree');
    }
  }
}