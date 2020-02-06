const Fs = require('fs')


class HyperLessPlugin {
  /* Called immediately after the plugin is
   * first imported, only once. */
  install (less, pluginManager, functions) {
    functions.add('init', () => {
      return Fs.readFileSync(__dirname + '/reset.less')
    })
  }

  /* Called for each instance of your @plugin. */
  use (context) { }

  /* Called for each instance of your @plugin,
   * when rules are being evaluated.
   * It's just later in the evaluation lifecycle */
  eval (context) { }

  /* Passes an arbitrary string to your plugin
   * e.g. @plugin (args) "file";
   * This string is not parsed for you,
   * so it can contain (almost) anything */
  setOptions (argumentString) { }

  /* Set a minimum Less compatibility string
   * You can also use an array, as in [3, 0] */
  // minVersion: ['3.0'],

  /* Used for lessc only, to explain
   * options in a Terminal */
  printUsage () { }

}

HyperLessPlugin.minVersion = ['3.0']

module.exports = HyperLessPlugin
