var fuzzyRank = function(){
  function escapeRegex(term){
    return term.replace(/\[\]\{\}\(\)\^\$\.\*\+\|/g, function(a){
      return '\\' + a;
    });
  }

  var UPPER = 0, LOWER = 1, NUMBER = 2, COMMON_DELIMS = 3, OTHER = 4;

  // Amount by which one character stands out when compared
  // to another character. Row = character in question,
  // col = character to compare to. E.g. uppercase letter
  // stands out with a factor of 220 compared to lowercase letter.
  // These numbers are pretty much plucked out of thin air.
  var relevanceMatrix = [
    [  0,   240,   120,   240,   220],
    [ 20,     0,    20,   120,   120],
    [140,   140,     0,   140,   140],
    [120,   120,   120,     0,   120],
    [120,   120,   120,   160,     0]
  ];

  function charType(c){
    if(/[a-z]/.test(c)) return LOWER;
    if(/[A-Z]/.test(c)) return UPPER;
    if(/[0-9]/.test(c)) return NUMBER;
    if(/[\/\-_\.]/.test(c)) return COMMON_DELIMS;
    return OTHER;
  }

  function compareCharacters(theChar, before, after){
    var theType = charType(theChar),
        beforeType = charType(before),
        afterType = charType(after);

    return relevanceMatrix[theType][beforeType] +
     0.4 * relevanceMatrix[theType][afterType];
  }

  function bestRank(item, term, startingFrom){
    // If we've reached the end of our search term, add some extra points for being short
    if(term.length === 0) return startingFrom * 100 / item.length;

    // If we've reached the end of the item but not the term, then fail.
    if(item.length === 0) return -1;

    // Quick sanity check to make sure the remaining item has all the characters we need in order
    if(!item.slice(startingFrom).match(
      new RegExp( ('^' + escapeRegex(term) + '$').split('').join('.*'), 'i' )
    )){
      return -1;
    }

    var firstSearchChar = term.charAt(0);
    var bestRankSoFar = -1;
    var highlights;

    for(var i = startingFrom; i < item.length; i += 1){
      if(item.charAt(i).toLowerCase() !== firstSearchChar.toLowerCase()) continue;

      var subsequentRank = bestRank(item.substr(i), term.slice(1), 1);
      if(subsequentRank == -1) continue;

      // Inverse quadratic score for the character. Earlier in string = much better
      var characterScore = 400 / Math.max(1, i);

      // If, starting at this character, we have the whole of the search term in order, that's really
      // good. And if the term is really long, make it cubically good (quadratic scores added up)
      if(item.substr(i).toLowerCase().indexOf(term.toLowerCase()) === 0) characterScore += 3 * term.length * term.length;

      // Add on score for how much this character stands out
      characterScore += compareCharacters(
        item.charAt(i),
        i === 0 ? '/' : item.charAt(i - 1),
        i === item.length - 1 ? '/' : item.charAt(i + 1)
      );

      // Add on score from the rest of the string
      characterScore += subsequentRank;

      if(characterScore > bestRankSoFar){
        bestRankSoFar = characterScore;

        highlights = [i];
        var subsequentHighlights = subsequentRank.highlights || [];
        for(var j = 0; j < subsequentHighlights.length; j += 1){
          highlights.push(subsequentHighlights[j] + i);
        }
      }
    }

    return {
      __score: bestRankSoFar,
      valueOf: function(){ return this.__score; },
      highlights: highlights
    };
  }

  function fuzzyScoreStr(item, term){
    return bestRank(item, term, 0);
  }

  function fuzzyScore(item, term, relevances){
    if(typeof item == 'string') return fuzzyScoreStr(item, term);

    var result = {
      __score: 0,
      valueOf: function(){ return this.__score; },
      highlights: {}
    };

    for(var i in relevances){
      if(!relevances.hasOwnProperty(i) || !item.hasOwnProperty(i)) continue;

      var thatScore = fuzzyScoreStr(item[i], term);

      result.__score += relevances[i] * thatScore;
      result.highlights[i] = thatScore > 0 ? thatScore.highlights : [];
    }

    return result;
  }

  return fuzzyScore;
}();


var fileList = [];

function addDirToList(dir, path){
  if(dir.dirs){
    for(var i in dir.dirs){
      if(dir.dirs.hasOwnProperty(i)) addDirToList(dir.dirs[i], path + i + '/');
    }
  }
  if(dir.files){
    for(var i = 0; i < dir.files.length; i += 1){
      fileList.push(path + dir.files[i]);
    }
  }
}

addDirToList(tree, '');

var searchBoxShown = false;
var searchingTimeout, selectedSearchIndex, selectedItem;

function doSearch(){
  var term = document.getElementById('searchbox').value;

  var items = [];

  for(var i = 0; i < fileList.length; i += 1){
    var f = fileList[i];
    var parts = f.split('/');
    var file = {
      fullPath: f,
      fileName: parts[parts.length - 1]
    };
    var rank = fuzzyRank(file, term, {
      fullPath: 1,
      fileName: 0.6
    });
    if(rank > 0){
      file.highlight = rank.highlights;
      file.score = +rank;
      items.push(file);
    }
  }

  items.sort(function(a, b){
    if(a.score > b.score) return -1;
    if(a.score < b.score) return 1;
    return 0;
  });

  renderSearchResults(items);
}

function highlightString(str, indexes){
  if(!indexes) return str;
  var out = '';
  for(var i = 0; i < str.length; i += 1){
    out += indexes.indexOf(i) !== -1 ? str.charAt(i).bold() : str.charAt(i);
  }
  return out;
}

function renderSearchResults(items){
  var html = '';
  for(var i = 0; i < items.length; i += 1){
    var f = items[i];
    html += [
      '<a class="item" data-value="', f.fullPath, '.html">',
        '<span class="score">', ~~f.score, '</span>',
        '<span class="filename">', highlightString(f.fileName, f.highlight.fileName), '</span>',
        '<span class="fullpath">', highlightString(f.fullPath, f.highlight.fullPath), '</span>',
      '</a>'
    ].join('');
  }

  document.getElementById('searchresults').innerHTML = html;

  selectIndex(0);
}

function selectIndex(idx){
  if(selectedItem) selectedItem.className = selectedItem.className.replace(/\s?selected/,'');
  var r = document.getElementById('searchresults');
  var items = r.childNodes;

  if(items.length === 0){
    selectedSearchIndex = -1;
    selectedItem = false;
    return;
  }

  selectedSearchIndex = idx;
  var s = selectedItem = items[idx];
  s.className += ' selected';

  var o = s.offsetTop - r.offsetTop - r.scrollTop;
  if(o < 0){
    r.scrollTop = s.offsetTop - r.offsetTop;
  }else if(o > r.offsetHeight - s.offsetHeight){
    r.scrollTop = o + r.scrollTop - r.offsetHeight + s.offsetHeight;
  }
}

function selectNextItem(){
  var items = document.getElementById('searchresults').childNodes;
  selectIndex((selectedSearchIndex + 1) % items.length);
}

function selectPreviousItem(){
  var items = document.getElementById('searchresults').childNodes;
  var l = items.length;
  selectIndex((selectedSearchIndex + l - 1) % l);
}

function searchFormKeyDown(e){
  e = e || window.event;
  if(e.keyCode == 27){
    document.body.removeChild(document.getElementById('search'));
    searchBoxShown = false;
  }else if(e.keyCode == 40){
    selectNextItem();
    e.preventDefault();
    e.stopPropagation();
    return false;
  }else if(e.keyCode == 38){
    selectPreviousItem();
    e.preventDefault();
    e.stopPropagation();
    return false;
  }else{
    clearTimeout(searchingTimeout);
    searchingTimeout = setTimeout(doSearch, 150);
  }
}

function addEvent(obj, evt, func, a){
  if((a = obj.addEventListener)){
    a.call(obj, evt, func, false);
  }else{
    obj.attachEvent('on' + evt, func);
  }
}

function searchFormSubmitted(e){
  e = e || window.event;
  e.preventDefault();

  if(!selectedItem) return false;

  window.location.href = relativeDir + selectedItem.getAttribute('data-value');

  return false;
}

function itemClicked(e){
  var levels = 5;
  var target = (e || window.event).target;
  while(levels-- && target.tagName !== 'A') target = target.parentNode;

  selectedItem = target;
  searchFormSubmitted(e);
}

function showSearchBox(val){
  if(searchBoxShown) return;
  searchBoxShown = true;

  var f = document.createElement('div');

  f.id = "search";

  f.innerHTML = [
    '<div class="overlay"></div>',
    '<div class="box">',
      '<form id="searchform">',
        '<input id="searchbox" type="text" name="file" placeholder="Go to file..." autocomplete="off" value="', val, '"/>',
      '</form>',
      '<div id="searchresults"></div>',
    '</div>'
  ].join('');

  addEvent(f, 'keydown', searchFormKeyDown);

  document.body.appendChild(f);

  document.getElementById('searchbox').focus();
  addEvent(document.getElementById('searchform'), 'submit', searchFormSubmitted);
  addEvent(document.getElementById('searchresults'), 'click', itemClicked);

  if(val) doSearch();
}

function fileSearch_kd(e){
  e = e || window.event;
  if(e.keyCode === 80 && (e.ctrlKey || e.metaKey)){
    showSearchBox();
    e.preventDefault();
    return false;
  }
}

function fileSearch_kp(e){
  e = e || window.event;

  if(e.ctrlKey || e.altKey || e.metaKey || e.target.tagName === 'INPUT') return true;
  var theChar = String.fromCharCode(e.which);

  if(/[a-zA-Z0-9\.\/\_\-]/.test(theChar)) showSearchBox(theChar);
}

addEvent(document, 'keydown', fileSearch_kd);
addEvent(document, 'keypress', fileSearch_kp);
