function parse(text, options = {}) {
  var pos = options.pos || 0;
  var keepComments = !!options.keepComments;
  var keepWhitespace = !!options.keepWhitespace;

  var openBracket = '<';
  var openBracketCC = '<'.charCodeAt(0);
  var closeBracket = '>';
  var closeBracketCC = '>'.charCodeAt(0);
  var minusCC = '-'.charCodeAt(0);
  var slashCC = '/'.charCodeAt(0);
  var exclamationCC = '!'.charCodeAt(0);
  var singleQuoteCC = "'".charCodeAt(0);
  var doubleQuoteCC = '"'.charCodeAt(0);
  var openCornerBracketCC = '['.charCodeAt(0);
  var closeCornerBracketCC = ']'.charCodeAt(0);

  /**
   * parsing a list of entries
   */
  function parseChildren(tagName) {
    var children = [];
    while (text[pos]) {
      if (text.charCodeAt(pos) == openBracketCC) {
        if (text.charCodeAt(pos + 1) === slashCC) {
          var closeStart = pos + 2;
          pos = text.indexOf(closeBracket, pos);

          var closeTag = text.substring(closeStart, pos);
          if (closeTag.indexOf(tagName) == -1) {
            var parsedText = text.substring(0, pos).split('\n');
            throw new Error(
              'Unexpected close tag\nLine: ' +
                (parsedText.length - 1) +
                '\nColumn: ' +
                (parsedText[parsedText.length - 1].length + 1) +
                '\nChar: ' +
                text[pos]
            );
          }

          if (pos + 1) pos += 1;

          return children;
        } else if (text.charCodeAt(pos + 1) === exclamationCC) {
          if (text.charCodeAt(pos + 2) == minusCC) {
            //comment support
            const startCommentPos = pos;
            while (
              pos !== -1 &&
              !(
                text.charCodeAt(pos) === closeBracketCC &&
                text.charCodeAt(pos - 1) == minusCC &&
                text.charCodeAt(pos - 2) == minusCC &&
                pos != -1
              )
            ) {
              pos = text.indexOf(closeBracket, pos + 1);
            }
            if (pos === -1) {
              pos = text.length;
            }
            if (keepComments) {
              children.push(text.substring(startCommentPos, pos + 1));
            }
          } else if (
            text.charCodeAt(pos + 2) === openCornerBracketCC &&
            text.charCodeAt(pos + 8) === openCornerBracketCC &&
            text.substr(pos + 3, 5).toLowerCase() === 'cdata'
          ) {
            // cdata
            var cdataEndIndex = text.indexOf(']]>', pos);
            if (cdataEndIndex == -1) {
              children.push(text.substr(pos + 9));
              pos = text.length;
            } else {
              children.push(text.substring(pos + 9, cdataEndIndex));
              pos = cdataEndIndex + 3;
            }
            continue;
          } else {
            // doctypesupport
            const startDoctype = pos + 1;
            pos += 2;
            var encapsuled = false;
            while ((text.charCodeAt(pos) !== closeBracketCC || encapsuled === true) && text[pos]) {
              if (text.charCodeAt(pos) === openCornerBracketCC) {
                encapsuled = true;
              } else if (encapsuled === true && text.charCodeAt(pos) === closeCornerBracketCC) {
                encapsuled = false;
              }
              pos++;
            }
            children.push(text.substring(startDoctype, pos));
          }
          pos++;
          continue;
        }
        var node = parseNode();
        children.push(node);
        if (node.tagName[0] === '?') {
          children.push(...node.children);
          node.children = [];
        }
      } else {
        var parsedText = parseText();
        if (keepWhitespace) {
          if (parsedText.length > 0) {
            children.push(parsedText);
          }
        } else {
          var trimmed = parsedText.trim();
          if (trimmed.length > 0) {
            children.push(trimmed);
          }
        }
        pos++;
      }
    }
    return children;
  }

  /**
   *    returns the text outside of texts until the first '<'
   */
  function parseText() {
    var start = pos;
    pos = text.indexOf(openBracket, pos) - 1;
    if (pos === -2) pos = text.length;
    return text.slice(start, pos + 1);
  }
  /**
   *    returns text until the first nonAlphabetic letter
   */
  var nameSpacer = '\r\n\t>/= ';

  function parseName() {
    var start = pos;
    while (nameSpacer.indexOf(text[pos]) === -1 && text[pos]) {
      pos++;
    }
    return text.slice(start, pos);
  }
  /**
   *    is parsing a node, including tagName, Attributes and its children,
   * to parse children it uses the parseChildren again, that makes the parsing recursive
   */
  var NoChildNodes = options.noChildNodes || ['img', 'br', 'input', 'meta', 'link', 'hr'];

  function parseNode() {
    pos++;
    const tagName = parseName();
    const attributes = {};
    let children = [];

    // parsing attributes
    while (text.charCodeAt(pos) !== closeBracketCC && text[pos]) {
      var c = text.charCodeAt(pos);
      if ((c > 64 && c < 91) || (c > 96 && c < 123)) {
        //if('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.indexOf(S[pos])!==-1 ){
        var name = parseName();
        // search beginning of the string
        var code = text.charCodeAt(pos);
        while (
          code &&
          code !== singleQuoteCC &&
          code !== doubleQuoteCC &&
          !((code > 64 && code < 91) || (code > 96 && code < 123)) &&
          code !== closeBracketCC
        ) {
          pos++;
          code = text.charCodeAt(pos);
        }
        if (code === singleQuoteCC || code === doubleQuoteCC) {
          var value = parseString();
          if (pos === -1) {
            return {
              tagName,
              attributes,
              children,
            };
          }
        } else {
          value = null;
          pos--;
        }
        attributes[name] = value;
      }
      pos++;
    }
    // optional parsing of children
    if (text.charCodeAt(pos - 1) !== slashCC) {
      if (tagName == 'script') {
        var start = pos + 1;
        pos = text.indexOf('</script>', pos);
        children = [text.slice(start, pos)];
        pos += 9;
      } else if (tagName == 'style') {
        var start = pos + 1;
        pos = text.indexOf('</style>', pos);
        children = [text.slice(start, pos)];
        pos += 8;
      } else if (NoChildNodes.indexOf(tagName) === -1) {
        pos++;
        children = parseChildren(tagName);
      } else {
        pos++;
      }
    } else {
      pos++;
    }
    return {
      tagName,
      attributes,
      children,
    };
  }

  /**
   *    is parsing a string, that starts with a char and with the same usually  ' or "
   */

  function parseString() {
    var startChar = text[pos];
    var startpos = pos + 1;
    pos = text.indexOf(startChar, startpos);
    return text.slice(startpos, pos);
  }

  /**
   *
   */
  function findElements() {
    var r = new RegExp('\\s' + options.attrName + '\\s*=[\'"]' + options.attrValue + '[\'"]').exec(
      text
    );
    if (r) {
      return r.index;
    } else {
      return -1;
    }
  }

  var out = null;
  if (options.attrValue !== undefined) {
    options.attrName = options.attrName || 'id';
    var out = [];

    while ((pos = findElements()) !== -1) {
      pos = text.lastIndexOf('<', pos);
      if (pos !== -1) {
        out.push(parseNode());
      }
      text = text.substr(pos);
      pos = 0;
    }
  } else if (options.parseNode) {
    out = parseNode();
  } else {
    out = parseChildren('');
  }

  if (options.filter) {
    out = filter(out, options.filter);
  }

  if (options.simplify) {
    return simplify(Array.isArray(out) ? out : [out]);
  }

  if (options.setPos) {
    out.pos = pos;
  }

  return out;
}

/**
 * behaves the same way as Array.filter, if the filter method return true, the element is in the resultList
 * @params children{Array} the children of a node
 * @param f{function} the filter method
 */
function filter(children, f, dept = 0, path = '') {
  var out = [];
  children.forEach(function (child, i) {
    if (typeof child === 'object' && f(child, i, dept, path)) out.push(child);
    if (child.children) {
      var kids = filter(
        child.children,
        f,
        dept + 1,
        (path ? path + '.' : '') + i + '.' + child.tagName
      );
      out = out.concat(kids);
    }
  });
  return out;
}

module.exports = { parse, filter };
