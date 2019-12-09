// knicked from: https://github.com/vadimdemedes/buble-register
// modified to use rollup

const Path = require('path')
const fs = require('fs')
const sourceMapSupport = require('source-map-support')
const escapeRegExp = require('lodash.escaperegexp')
const { isRegExp } = require('util').types
const minimatch = require('minimatch')
const { addHook } = require('pirates')
const arrify = require('arrify')
const slash = require('slash')
const rollup = require('rollup')
const deasync = require('deasync')
const debug = require('debug')('rollup-register')

const findCacheDir = require('find-cache-dir')
const CACHE_DIR = findCacheDir({name: 'rollup-register'})

const startsWith = (str, match) => str.indexOf(match) === 0

// ----
// default register options (re-register it if you don't like them.)
// ----

const plugin_import_alias = require('../../architect/rollup-plugin-import-alias')
const plugin_replace = require('@rollup/plugin-replace')
const lib_path = Path.resolve(__dirname, '..') + '/'
const is_production = process.env.NODE_ENV === 'production'

const default_opts = {
  extensions: ['.js', '.jsx', '.es6', '.es', '.mjs'],
  input: {
    plugins: [
      plugin_import_alias({
        '@lib/': lib_path,
        '@hyper/': lib_path,
        '@lodash/': lib_path + 'lodash/',
      }),
      plugin_replace({
        DEBUG: JSON.stringify(!is_production),
        __PRODUCTION__: JSON.stringify(is_production), // do I need JSON.stringify??
        NULL_LISTENERS_RUN_COMPACTOR: '9', // after finding 9 nulls, compact the array
      }),
    ],
  },
}

// @Cleanup: copy this to hyper-js?
function regexify (val) {
  if (!val) {
    return new RegExp(/.^/)
  }

  if (Array.isArray(val)) {
    val = new RegExp(val.map(escapeRegExp).join('|'), 'i')
  }

  if (typeof val === 'string') {
    val = slash(val)

    if (startsWith(val, './') || startsWith(val, '*/')) {
      val = val.slice(2)
    }

    if (startsWith(val, '**/')) {
      val = val.slice(3)
    }

    const regex = minimatch.makeRe(val, {nocase: true})

    return new RegExp(regex.source.slice(1, -1), 'i')
  }

  if (isRegExp(val)) {
    return val
  }

  return new TypeError('Illegial type for regexify')
}

let maps = {}
let input_options = {}
let output_options = {}
let piratesRevert
let ignore
let only

sourceMapSupport.install({
  handleUncaughtExtensions: false,
  environment: 'node',
  retrieveSourceMap: source => {
    debug('retrive src map for:', source)
    const map = maps[source]

    if (map) {
      debug('found it!')
    }

    return map ? { url: null, map } : null
  }
})

// registerCache.load()
// let cache = registerCache.get()

const cwd = process.cwd()
const getRelativePath = filename => Path.relative(cwd, filename)
const mtime = filename => Number(fs.statSync(filename).mtime)

function _shouldIgnore (pattern, filename) {
  return typeof pattern === 'function' ? pattern(filename) : pattern.test(filename)
}

function shouldIgnore (filename) {
  if (!ignore && !only) {
    return getRelativePath(filename).split(Path.sep).indexOf('node_modules') >= 0
  }

  filename = filename.replace(/\\/g, '/')

  if (only) {
    for (const pattern of only) {
      if (_shouldIgnore(pattern, filename)) {
        return false
      }
    }

    return true
  }

  if (ignore.length > 0) {
    for (const pattern of ignore) {
      if (_shouldIgnore(pattern, filename)) {
        return true
      }
    }
  }

  return false
}

function compile (code, filename) {
  if (shouldIgnore(filename) || !/(im|ex)port/.test(code)) {
    return code
  }

  debug('rollup:compile', filename)

  // const cacheKey = `${filename}:${JSON.stringify(transformOpts)}:${buble.VERSION}`

  // if (cache) {
  //   const cached = cache[cacheKey]
  //
  //   if (cached && cached.mtime === mtime(filename)) {
  //     return cached.code
  //   }
  // }

  // const opts = Object.assign({}, transformOpts, {
  //   // source: filename
  //   input: filename
  // })

  let result = deasync(rollup_transform)(filename, code)
  let { output } = result
  for (const chunkOrAsset of output) {
    if (chunkOrAsset.type === 'asset') {
      // For assets, this contains
      // {
      //   fileName: string,              // the asset file name
      //   source: string | Buffer        // the asset source
      //   type: 'asset'                  // signifies that this is an asset
      // }
      // console.log('Asset', chunkOrAsset);
    } else {
      // For chunks, this contains
      // {
      //   code: string,                  // the generated JS code
      //   dynamicImports: string[],      // external modules imported dynamically by the chunk
      //   exports: string[],             // exported variable names
      //   facadeModuleId: string | null, // the id of a module that this chunk corresponds to
      //   fileName: string,              // the chunk file name
      //   imports: string[],             // external modules imported statically by the chunk
      //   isDynamicEntry: boolean,       // is this chunk a dynamic entry point
      //   isEntry: boolean,              // is this chunk a static entry point
      //   map: string | null,            // sourcemaps if present
      //   modules: {                     // information about the modules in this chunk
      //     [id: string]: {
      //       renderedExports: string[]; // exported variable names that were included
      //       removedExports: string[];  // exported variable names that were removed
      //       renderedLength: number;    // the length of the remaining code in this module
      //       originalLength: number;    // the original length of the code in this module
      //     };
      //   },
      //   name: string                   // the name of this chunk as used in naming patterns
      //   type: 'chunk',                 // signifies that this is a chunk
      // }
      // console.log('Chunk', chunkOrAsset.modules);
    }
  }

  result = result.output[0]
  let diff = code.length - result.code.length

  // if (cache) {
  //   result.mtime = mtime(filename)
  //   cache[cacheKey] = result
  // }

  maps[filename] = result.map

  return result.code
}

function rollup_transform (filename, code, cb) {
  // console.log('doing transform')
  // console.log('doing transform')
  // console.log('doing transform')
  // console.log('input:before', input_options)
  let input_opts = Object.assign({}, input_options, {
    input: filename,
    acorn: { allowReturnOutsideFunction: true, allowHashBang: true }
  })
  // console.log('input:after', input_opts)
  // console.log('output:before', output_options)
  let output_opts = Object.assign({}, output_options, {
    file: Path.join(CACHE_DIR, filename),
    format: 'cjs'
  })
  // console.log('output:after', output_opts)
  try {
    rollup.rollup(input_opts).then((bundle) => {
      return bundle.generate(output_opts)
    }).then((res) => {
      if (cb) cb(null, res)
    }).catch((err) => {
      if (err.code === 'PARSE_ERROR') {
        console.log(err.parserError.message)
        console.log(`  in ${err.loc.file}:${err.loc.line}:${err.loc.column}`)
        console.log(err.frame)
      }

      if (cb) cb(err)
      else throw err
    })
  } catch (err) {
    if (cb) cb(err)
    else throw err
  }
}

function hookExtensions (exts) {
  if (piratesRevert) {
    piratesRevert()
  }

  piratesRevert = addHook(compile, {
    exts,
    ignoreNodeModules: false
  })
}

function revert () {
  if (piratesRevert) {
    piratesRevert()
  }

  delete require.cache[require.resolve(__filename)]
}

function register (opts = default_opts, input_opts = {}, output_opts = {}) {
  opts = Object.assign({ extensions: ['.js', '.jsx', '.es6', '.es', '.mjs'] }, opts)
  input_options = input_opts
  output_options = output_opts

  if (opts.revert === false && piratesRevert) return

  debug('registering', opts)

  if (opts.extensions) {
    hookExtensions(opts.extensions)
  }

  // if (opts.cache === false) {
  //   cache = null
  // }

  if (opts.ignore) {
    ignore = arrify(opts.ignore).map(regexify)
  }

  if (opts.only) {
    only = arrify(opts.only).map(regexify)
  }

  if (opts.input) {
    input_options = Object.assign(input_options, opts.input)
  }

  if (opts.output) {
    output_options = Object.assign(output_options, opts.output)
  }
}

register(default_opts)

// var { print_error } = require('../error.js')

module.exports = register
module.exports.revert = revert
