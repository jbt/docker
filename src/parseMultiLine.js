module.exports = function(comment){
  var commentData = { tags: [], description: {} };

  if(!/^\s*@/.test(comment)){

    // Split out a summary and body from the comment
    var full = comment.split('\n@')[0];

    commentData.description.summary = full.split(/\n\s*\n\s*/)[0];
    commentData.description.body = full.split(/\n\s*\n\s*/).slice(1).join('\n\n');

  }else{

    // If the comment starts with a tag, do nothing
    commentData.description.summary = '';
    commentData.description.body = '';
  }


  // grabType function grabs the type out of an array of space-separated
  // bits, so for example we can pick up {string, optional} from the beginning
  // of a tag. `bits` is passed in as an array so we can shift and unshift
  // to remove the type from it.
  function grabType(bits){
    var type = bits.shift();
    var badChars = /[&<>"'`]/g;
    var escape = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#x27;",
      "`": "&#x60;"
    };

    // Carry on adding bits until we reach a closing brace
    while(bits.length && type.indexOf('}') === -1) type += bits.shift();

    // If for whatever reason the tag was of the format {type}blah without
    // the trailing space after the }, extract whatever was left over and
    // put it back onto the bits array.
    if(!/\}$/.test(type)){
      bits.unshift(type.replace(/^.*\}(.*)$/, '$1'));
      type = type.replace(/\}.*$/,'}');
    }

    function escapeChar(chr) {
      return escape[chr] || "&amp;";
    }

    type = type.replace(badChars, escapeChar);

    return type.replace(/[{}]/g,'');
  }

  // Prepend a newline here in case the comment starts with a tag
  comment = '\n' + comment;

  // If we have jsDoc-style parameters, parse them
  if(comment.indexOf('\n@') !== -1){
    var tags = comment.split('\n@').slice(1);

    // Loop through all of the tags and process the ones we support
    commentData.tags = tags.map(function(line){
      var bits = line.split(' '), tag = {};
      var tagType = tag.type = bits.shift();

      switch(tagType){
        case 'arg':
        case 'argument':
        case 'param':
          // `@param {typename} paramname Parameter description`
          if(bits[0].charAt(0) == '{') tag.types = grabType(bits).split(/ *[|,\/] */);
          tag.name = bits.shift() || '';
          tag.description = bits.join(' ');
          tag.type = 'param';
          break;

        case 'returns':
        case 'return':
          // `@return {typename} Return description`
          if(bits[0].charAt(0) == '{') tag.types = grabType(bits).split(/ *[|,\/] */);
          tag.description = bits.join(' ');
          tag.type = 'return';
          break;

        case 'type':
          // `@type {typename}`
          tag.types = grabType(bits).split(/ *[|,\/] */);
          break;

        case 'access':
        case 'api':
          // `@api public` or `@api private` etc.
          tag.visibility = bits.shift();
          tag.type = 'api';
          break;

        case 'private':
        case 'protected':
        case 'public':
          // `@public` or `@private` etc.
          tag.visibility = tagType;
          tag.type = 'api';
          break;

        case 'see':
          // `@see Title http://url` or `@see local place`
          if(/http/.test(line)){
            tag.title = bits.length > 1 ? bits.shift() : '';
            tag.url = bits.join(' ');
          }else{
            tag.local = bits.join(' ');
          }
          break;
        default:
          if(bits.length > 0 && bits[0].charAt(0) == '{') tag.types = grabType(bits).split(/ *[|,\/] */);
          tag.description = bits.join(' ');
          tag.name = tagType;
          tag.type = 'unknown';
      }

      return tag;
    });
  }

  return commentData;
};
