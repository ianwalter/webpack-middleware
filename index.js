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
    stats,
    development = (!NODE_ENV || NODE_ENV === 'development'),
    hot = { reload: true }
  } = options

  // Create the serverCompiler using Webpack and the given Webpack server
  // configuration. Tell Webpack to use a memory filesystem to cut out
  // unnecessary writes/reads to the filesystem. Finally, instruct Webpack to
  // update the serverBundle and renderer when changes are detected.
  if (development && serverConfig) {
    const serverCompiler = webpack(serverConfig)
    const mfs = new MemoryFileSystem()
    serverCompiler.outputFileSystem = mfs
    serverCompiler.watch({}, () => serverHook(mfs))
  }

  return function mercuryWebpackMiddleware (req, res, next) {
    if (development) {
      const WebpackDevMiddleware = require('webpack-dev-middleware')
      const WebpackHotMiddleware = require('webpack-hot-middleware')

      // Modify the given client Webpack configuration to add the
      // WebpackHotMiddleware client code to be the first module in the client
      // bundle. Create the clientCompiler using Webpack and the given client
      // Webpack configuration. Add a plugin to the clientCompiler that updates
      // the clientManifest and renderer whenever the clientCompiler has
      // finished a compile run.
      clientConfig.entry = ['webpack-hot-middleware/client', clientConfig.entry]
      const clientCompiler = webpack(clientConfig)
      clientCompiler.plugin('done', () => clientHook(devMiddleware))
      const hotMiddleware = WebpackHotMiddleware(clientCompiler, hot)

      // Create the WebpackDevMiddleware instance using the clientCompiler.
      // Configure it to use Fastify's log and the given stats configuration if
      // it's defined. Instruct fastify to use the WebpackDevMiddleware
      // instance.
      const devMiddleware = WebpackDevMiddleware(clientCompiler, {
        publicPath: clientConfig.output.publicPath,
        logger: req.log,
        ...(stats !== undefined ? { stats } : {})
      })

      // TODO: comment
      devMiddleware(req, res, function devMiddlewareNext () {
        hotMiddleware(req, res, next)
      })
    } else {
      next()
    }
  }
}
