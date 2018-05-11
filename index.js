const { join } = require('path')

const MemoryFileSystem = require('memory-fs')
const webpack = require('webpack')

const { NODE_ENV } = process.env
const noOp = () => {}

module.exports = function mecuryWebpack (options) {
  const {
    serverConfig,
    serverHook = noOp,
    clientConfig,
    clientHook = noOp,
    development = !NODE_ENV || NODE_ENV === 'development',
    logger,
    stats,
  } = options

  let hotMiddleware
  let devMiddleware
  if (development) {
    // Create the serverCompiler using Webpack and the given Webpack server
    // configuration. Tell Webpack to use a memory filesystem to cut out
    // unnecessary writes/reads to the filesystem. Finally, instruct Webpack to
    // update the serverBundle and renderer when changes are detected.
    if (serverConfig) {
      const serverCompiler = webpack(serverConfig)
      const mfs = new MemoryFileSystem()
      serverCompiler.outputFileSystem = mfs
      serverCompiler.watch({}, () => serverHook(mfs))
    }

    const WebpackDevMiddleware = require('webpack-dev-middleware')
    const WebpackHotMiddleware = require('webpack-hot-middleware')

    // Modify the given client Webpack configuration to add the
    // WebpackHotMiddleware client code to be the first module in the client
    // bundle. Create the clientCompiler using Webpack and the given client
    // Webpack configuration. Add a plugin to the clientCompiler that updates
    // the clientManifest and renderer whenever the clientCompiler has
    // finished a compile run.
    clientConfig.entry = [
      join(__dirname, 'client.js'),
      clientConfig.entry
    ]
    const clientCompiler = webpack(clientConfig)
    clientCompiler.plugin('done', () => clientHook(devMiddleware))
    hotMiddleware = WebpackHotMiddleware(clientCompiler, { reload: true })

    // Create the WebpackDevMiddleware instance using the clientCompiler.
    // Configure it to use the passed logger and the given stats configuration
    // if it's defined.
    devMiddleware = WebpackDevMiddleware(clientCompiler, {
      publicPath: clientConfig.output.publicPath,
      logger,
      ...(stats !== undefined ? { stats } : {})
    })
  }

  return function mercuryWebpackMiddleware (req, res, next) {
    if (development) {
      devMiddleware(req, res, function devMiddlewareNext (err) {
        if (err) {
          next(err)
        } else {
          hotMiddleware(req, res, next)
        }
      })
    } else {
      next()
    }
  }
}
