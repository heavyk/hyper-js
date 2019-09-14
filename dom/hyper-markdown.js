// originally:
/*
 * µmarkdown.js
 * markdown in under 5kb
 *
 * Copyright 2015, Simon Waldherr - http://simon.waldherr.eu/
 * Released under the MIT Licence
 * http://simon.waldherr.eu/license/mit/
 *
 * Github:  https://github.com/simonwaldherr/micromarkdown.js/
 * Version: 0.3.4
 */

/*jslint browser: true, node: true, plusplus: true, indent: 2, regexp: true, ass: true */
/*global ActiveXObject, define */

// instead of using crc32 as the codeblocks key, it may nice (and smaller) to have the original code used as the key
// codeblocks[code] = redered_html
// then, crc32 is no longer necessary
const crc32 = require('@hyper/hash/crc32')

const regex_headline = /^(\#{1,6})([^\#\n]+)$/m
const regex_code = /\s\`\`\`\n?([^`]+)\`\`\`/g
const regex_hr = /^(?:([\*\-_] ?)+)\1\1$/gm
const regex_lists = /^((\s*((\*|\-)|\d(\.|\))) [^\n]+)\n)+/gm
const regex_lists_loose = /^((\s*(\*|\d\.) [^\n]+)\n)+/gm
const regex_bolditalic = /(?:([\*_~]{1,3}))([^\*_~\n]+[^\*_~\s])\1/g
const regex_links = /!?\[([^\]<>]+)\]\(([^ \)<>]+)( "[^\(\)\"]+")?\)/g
const regex_reflinks = /\[([^\]]+)\]\[([^\]]+)\]/g
const regex_smlinks = /\@([a-z0-9]{3,})\@(t|gh|fb|gp|adn)/gi
const regex_mail = /<(([a-z0-9_\-\.])+\@([a-z0-9_\-\.])+\.([a-z]{2,7}))>/gmi
const regex_tables = /\n(([^|\n]+ *\| *)+([^|\n]+\n))((:?\-+:?\|)+(:?\-+:?)*\n)((([^|\n]+ *\| *)+([^|\n]+)\n)+)/g
const regex_include = /[\[<]include (\S+) from (https?:\/\/[a-z0-9\.\-]+\.[a-z]{2,9}[a-z0-9\.\-\?\&\/]+)[\]>]/gi
const regex_url = /<([a-zA-Z0-9@:%_\+.~#?&\/=]{2,256}\.[a-z]{2,4}\b(\/[\-a-zA-Z0-9@:%_\+.~#?&\/\/=]*)?)>/g
const regex_url2 = /[ \t\n]([a-zA-Z]{2,16}:\/\/[a-zA-Z0-9@:%_\+.~#?&=]{2,256}.[a-z]{2,4}\b(\/[\-a-zA-Z0-9@:%_\+.~#?&\/\/=]*)?)[ \t\n]/g

var codeblocks = {}

function parse (str, strict) {
  var line, nstatus = 0,
    status, cel, calign, indent, helper, helper1, helper2, count, repstr, stra, trashgc = [],
    casca = 0,
    i = 0,
    j = 0,
    crc32str = ''
  str = '\n' + str + '\n'

  str = str.replace('$&', '&#x0024&amp;')

  /* code */
  while ((stra = regex_code.exec(str)) !== null) {
    crc32str = crc32(stra[0])
    codeblocks[crc32str] = '<code>\n' + htmlEncode(stra[1]).replace(/\n/gm, '<br/>').replace(/\ /gm, '&nbsp;') + '</code>\n'
    str = str.replace(stra[0], ' §§§' + crc32str + '§§§ ')
  }

  /* headlines */
  while ((stra = regex_headline.exec(str)) !== null) {
    count = stra[1].length
    str = str.replace(stra[0], '<h' + count + '>' + stra[2] + '</h' + count + '>' + '\n')
  }

  /* lists */
  while ((stra = (strict ? regex_lists : regex_lists_loose).exec(str)) !== null) {
    casca = 0
    if ((stra[0].trim().substr(0, 1) === '*') || (stra[0].trim().substr(0, 1) === '-')) {
      repstr = '<ul>'
    } else {
      repstr = '<ol>'
    }
    helper = stra[0].split('\n')
    helper1 = []
    status = 0
    indent = false
    for (i = 0; i < helper.length; i++) {
      if ((line = /^((\s*)((\*|\-)|\d(\.|\))) ([^\n]+))/.exec(helper[i])) !== null) {
        if ((line[2] === undefined) || (line[2].length === 0)) {
          nstatus = 0
        } else {
          if (indent === false) {
            indent = line[2].replace(/\t/, '    ').length
          }
          nstatus = Math.round(line[2].replace(/\t/, '    ').length / indent)
        }
        while (status > nstatus) {
          repstr += helper1.pop()
          status--
          casca--
        }
        while (status < nstatus) {
          if ((line[0].trim().substr(0, 1) === '*') || (line[0].trim().substr(0, 1) === '-')) {
            repstr += '<ul>'
            helper1.push('</ul>')
          } else {
            repstr += '<ol>'
            helper1.push('</ol>')
          }
          status++
          casca++
        }
        repstr += '<li>' + line[6] + '</li>' + '\n'
      }
    }
    while (casca > 0) {
      repstr += '</ul>'
      casca--
    }
    if ((stra[0].trim().substr(0, 1) === '*') || (stra[0].trim().substr(0, 1) === '-')) {
      repstr += '</ul>'
    } else {
      repstr += '</ol>'
    }
    str = str.replace(stra[0], repstr + '\n')
  }

  /* tables */
  while ((stra = regex_tables.exec(str)) !== null) {
    repstr = '<table><tr>'
    helper = stra[1].split('|')
    calign = stra[4].split('|')
    for (i = 0; i < helper.length; i++) {
      if (calign.length <= i) {
        calign.push(0)
      } else if ((calign[i].trimRight().slice(-1) === ':') && (strict !== true)) {
        if (calign[i][0] === ':') {
          calign[i] = 3
        } else {
          calign[i] = 2
        }
      } else if (strict !== true) {
        if (calign[i][0] === ':') {
          calign[i] = 1
        } else {
          calign[i] = 0
        }
      } else {
        calign[i] = 0
      }
    }
    cel = ['<th>', '<th align="left">', '<th align="right">', '<th align="center">']
    for (i = 0; i < helper.length; i++) {
      repstr += cel[calign[i]] + helper[i].trim() + '</th>'
    }
    repstr += '</tr>'
    cel = ['<td>', '<td align="left">', '<td align="right">', '<td align="center">']
    helper1 = stra[7].split('\n')
    for (i = 0; i < helper1.length; i++) {
      helper2 = helper1[i].split('|')
      if (helper2[0].length !== 0) {
        while (calign.length < helper2.length) {
          calign.push(0)
        }
        repstr += '<tr>'
        for (j = 0; j < helper2.length; j++) {
          repstr += cel[calign[j]] + helper2[j].trim() + '</td>'
        }
        repstr += '</tr>' + '\n'
      }
    }
    repstr += '</table>'
    str = str.replace(stra[0], repstr)
  }

  /* bold and italic */
  for (i = 0; i < 3; i++) {
    while ((stra = regex_bolditalic.exec(str)) !== null) {
      repstr = []
      if (stra[1] === '~~') {
        str = str.replace(stra[0], '<del>' + stra[2] + '</del>')
      } else {
        switch (stra[1].length) {
          case 1:
            repstr = ['<i>', '</i>']
            break
          case 2:
            repstr = ['<b>', '</b>']
            break
          case 3:
            repstr = ['<i><b>', '</b></i>']
            break
        }
        str = str.replace(stra[0], repstr[0] + stra[2] + repstr[1])
      }
    }
  }

  /* links */
  while ((stra = regex_links.exec(str)) !== null) {
    if (stra[0].substr(0, 1) === '!') {
      str = str.replace(stra[0], '<img src="' + stra[2] + '" alt="' + stra[1] + '" title="' + stra[1] + '" />\n')
    } else {
      str = str.replace(stra[0], '<a ' + mmdCSSclass(stra[2], strict) + 'href="' + stra[2] + '">' + stra[1] + '</a>\n')
    }
  }
  while ((stra = regex_mail.exec(str)) !== null) {
    str = str.replace(stra[0], '<a href="mailto:' + stra[1] + '">' + stra[1] + '</a>')
  }
  while ((stra = regex_url.exec(str)) !== null) {
    repstr = stra[1]
    if (!~repstr.indexOf('://')) {
      repstr = 'http://' + repstr
    }
    str = str.replace(stra[0], '<a ' + mmdCSSclass(repstr, strict) + 'href="' + repstr + '">' + repstr.replace(/(https:\/\/|http:\/\/|mailto:|ftp:\/\/)/gmi, '') + '</a>')
  }
  while ((stra = regex_reflinks.exec(str)) !== null) {
    helper1 = new RegExp('\\[' + stra[2] + '\\]: ?([^ \n]+)', 'gi')
    if ((helper = helper1.exec(str)) !== null) {
      str = str.replace(stra[0], '<a ' + mmdCSSclass(helper[1], strict) + 'href="' + helper[1] + '">' + stra[1] + '</a>')
      trashgc.push(helper[0])
    }
  }
  for (i = 0; i < trashgc.length; i++) {
    str = str.replace(trashgc[i], '')
  }
  while ((stra = regex_smlinks.exec(str)) !== null) {
    switch (stra[2]) {
      case 't':
        repstr = 'https://twitter.com/' + stra[1]
        break
      case 'gh':
        repstr = 'https://github.com/' + stra[1]
        break
      case 'fb':
        repstr = 'https://www.facebook.com/' + stra[1]
        break
      case 'gp':
        repstr = 'https://plus.google.com/+' + stra[1]
        break
      case 'adn':
        repstr = 'https://alpha.app.net/' + stra[1]
        break
    }
    str = str.replace(stra[0], '<a ' + mmdCSSclass(repstr, strict) + 'href="' + repstr + '">' + stra[1] + '</a>')
  }
  while ((stra = regex_url2.exec(str)) !== null) {
    repstr = stra[1]
    str = str.replace(stra[0], '<a ' + mmdCSSclass(repstr, strict) + 'href="' + repstr + '">' + repstr + '</a>')
  }

  /* horizontal line */
  while ((stra = regex_hr.exec(str)) !== null) {
    str = str.replace(stra[0], '\n<hr/>\n')
  }

  /* include */
  // if ((useajax !== false) && (strict !== true)) {
  //   while ((stra = regex_include.exec(str)) !== null) {
  //     helper = stra[2].replace(/[\.\:\/]+/gm, '')
  //     helper1 = ''
  //     if (document.getElementById(helper)) {
  //       helper1 = document.getElementById(helper).innerHTML.trim()
  //     } else {
  //       ajax(stra[2])
  //     }
  //     if ((stra[1] === 'csv') && (helper1 !== '')) {
  //       helper2 = {
  //         ';': [],
  //         '\t': [],
  //         ',': [],
  //         '|': []
  //       }
  //       helper2[0] = [';', '\t', ',', '|']
  //       helper1 = helper1.split('\n')
  //       for (j = 0; j < helper2[0].length; j++) {
  //         for (i = 0; i < helper1.length; i++) {
  //           if (i > 0) {
  //             if (helper2[helper2[0][j]] !== false) {
  //               if ((helper2[helper2[0][j]][i] !== helper2[helper2[0][j]][i - 1]) || (helper2[helper2[0][j]][i] === 1)) {
  //                 helper2[helper2[0][j]] = false
  //               }
  //             }
  //           }
  //         }
  //       }
  //       if ((helper2[';'] !== false) || (helper2['\t'] !== false) || (helper2[','] !== false) || (helper2['|'] !== false)) {
  //         if (helper2[';'] !== false) {
  //           helper2 = ';'
  //         } else if (helper2['\t']) {
  //           helper2 = '\t'
  //         } else if (helper2[',']) {
  //           helper2 = ','
  //         } else if (helper2['|']) {
  //           helper2 = '|'
  //         }
  //         repstr = '<table>'
  //         for (i = 0; i < helper1.length; i++) {
  //           helper = helper1[i].split(helper2)
  //           repstr += '<tr>'
  //           for (j = 0; j < helper.length; j++) {
  //             repstr += '<td>' + htmlEncode(helper[j]) + '</td>'
  //           }
  //           repstr += '</tr>'
  //         }
  //         repstr += '</table>'
  //         str = str.replace(stra[0], repstr)
  //       } else {
  //         str = str.replace(stra[0], '<code>' + helper1.join('\n') + '</code>')
  //       }
  //     } else {
  //       str = str.replace(stra[0], '')
  //     }
  //   }
  // }

  str = str.replace(/ {2,}[\n]{1,}/gmi, '<br/><br/>')

  for (var index in codeblocks) {
    if (codeblocks.hasOwnProperty(index)) {
      str = str.replace('§§§' + index + '§§§', codeblocks[index])
    }
  }
  str = str.replace('&#x0024&amp;', '$&')

  return str
}

// function ajax (str) {
//   var xhr
//   if (document.getElementById(str.replace(/[\.\:\/]+/gm, ''))) {
//     return false
//   }
//   if (window.ActiveXObject) {
//     try {
//       xhr = new ActiveXObject('Microsoft.XMLHTTP')
//     } catch (e) {
//       xhr = null
//       return e
//     }
//   } else {
//     xhr = new XMLHttpRequest()
//   }
//   xhr.onreadystatechange = function () {
//     if (xhr.readyState === 4) {
//       var ele = document.createElement('code')
//       ele.innerHTML = xhr.responseText
//       ele.id = str.replace(/[\.\:\/]+/gm, '')
//       ele.style.display = 'none'
//       document.getElementsByTagName('body')[0].appendChild(ele)
//       useajax()
//     }
//   }
//   xhr.open('GET', str, true)
//   xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded')
//   xhr.send()
// }

function htmlEncode (str) {
  // var div = document.createElement('div')
  // div.appendChild(document.createTextNode(str))
  // str = div.innerHTML
  // div = undefined
  return str
}

function mmdCSSclass (str, strict) {
  var urlTemp
  if (~str.indexOf('/') && strict !== true) {
    urlTemp = str.split('/')
    if (urlTemp[1].length === 0) {
      urlTemp = urlTemp[2].split('.')
    } else {
      urlTemp = urlTemp[0].split('.')
    }
    return 'class="mmd_' + urlTemp[urlTemp.length - 2].replace(/[^\w\d]/g, '') + urlTemp[urlTemp.length - 1] + '" '
  }
  return ''
}

module.exports = { parse }

if (!module.parent) {
  var colors = require('colors')
  var tests = [
    {'name': 'header 1', 'input': '#Header1', 'output': '<h1>Header1</h1>'},
    {'name': 'header 2', 'input': '##Header2', 'output': '<h2>Header2</h2>'},
    {'name': 'header 3', 'input': '###Header3', 'output': '<h3>Header3</h3>'},
    {'name': 'code 1', 'input': '```some_code```', 'output': '<code>\nsome_code</code>'},
    {'name': 'code 2', 'input': '```some code```', 'output': '<code>\nsome&nbsp;code</code>'},
    {'name': 'link 1', 'input': '[SimonWaldherr](http://simon.waldherr.eu/)', 'output': '<a href="http://simon.waldherr.eu/">SimonWaldherr</a>'},
    {'name': 'link 2', 'input': '[SimonWaldherr][1]\n[1]: http://simon.waldherr.eu/', 'output': '<a href="http://simon.waldherr.eu/">SimonWaldherr</a>'},
    {'name': 'link 3', 'input': '[foobar $& example](http://google.de)', 'output': '<a href="http://google.de">foobar &#x0024&amp; example</a>'},
    {'name': 'bold', 'input': '**bold** text', 'output': '<b>bold</b> text'},
    {'name': 'italic', 'input': '*italic* test', 'output': '<i>italic</i> test'},
    {'name': 'bold+italic', 'input': '*italic and **bold** text*', 'output': '<i>italic and <b>bold</b> text</i>'},
    {'name': 'ordered list', 'input': '1. this\n2. is a\n3. list', 'output': '<ol><li>this</li>\n<li>is a</li>\n<li>list</li>\n</ol>'},
    {'name': 'unordered list', 'input': '* this\n* is a\n* list', 'output': '<ul><li>this</li>\n<li>is a</li>\n<li>list</li>\n</ul>'},
    {'name': 'nested list', 'input': '* this\n* is a\n  1. test\n  1. and\n  1. demo\n* list', 'output': '<ul><li>this</li>\n<li>is a</li>\n<ol><li>test</li>\n<li>and</li>\n<li>demo</li>\n</ol><li>list</li>\n</ul>'},
    {'name': 'table', 'input': 'this | is a   | table  \n-----|--------|--------\nwith | sample | content\nlorem| ipsum  | dolor  \nsit  | amet   | sed    \ndo   | eiusom | tempor ', 'output': '<table><tr><th>this</th><th>is a</th><th>table</th></tr><tr><td>with</td><td>sample</td><td>content</td></tr>\n<tr><td>lorem</td><td>ipsum</td><td>dolor</td></tr>\n<tr><td>sit</td><td>amet</td><td>sed</td></tr>\n<tr><td>do</td><td>eiusom</td><td>tempor</td></tr>\n</table>'},
  ]

  for(i in tests) {
    if(parse(tests[i].input, true).trim() === tests[i].output) {
      console.log(tests[i].name.green)
    } else {
      console.log(tests[i].name.red)
    }
  }
}
