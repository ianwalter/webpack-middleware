const MemoryFileSystem = require('memory-fs')
const webpack = require('webpack')
const hotClient = require('webpack-hot-client')
const WebpackDevMiddleware = require('webpack-dev-middleware')
const { oneLineTrim } = require('common-tags')

const { NODE_ENV } = process.env
const noOp = () => {}

module.exports = function webpackMiddleware (options) {
  const {
    serverConfig,
    serverHook = noOp,
    clientConfig,
    clientHook = noOp,
    development = !NODE_ENV || NODE_ENV === 'development',
    logger,
    stats,
    // The max amount of 100ms attempts that the middleware should attempt to
    // wait for the hot server to start listening.
    serverCheckAttempts = 600
  } = options

  let serverCheckErr
  let devMiddleware
  if (development) {
    // Create an error message for the case when the Hot Client server hasn't
    // started listening after the max number of check attempts.
    serverCheckErr = new Error(oneLineTrim`
      Hot Client server was not listening after
      ${serverCheckAttempts * 100 / 1000}s.
    `)

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

    // Create the client Webpack compiler instance and add a plugin that calls
    // the clientHook after each compilation is done.
    const clientCompiler = webpack(clientConfig)
    clientCompiler.plugin('done', () => clientHook(devMiddleware))

    // Create the Hot Client instance and add a callback to the server so that
    // the WebpackDevMiddleware instance is created after the server has started
    // listening.
    const { server } = hotClient(clientCompiler)
    server.on('listening', () => {
      // Create the WebpackDevMiddleware instance using the clientCompiler.
      // Configure it to use the passed logger and the given stats configuration
      // if it's defined.
      const getPublicPath = c => c.output ? c.output.publicPath : '/'
      const publicPath = Array.isArray(clientConfig)
        ? getPublicPath(clientConfig[0])
        : getPublicPath(clientConfig)
      devMiddleware = WebpackDevMiddleware(clientCompiler, {
        publicPath,
        logger,
        ...(stats !== undefined ? { stats } : {})
      })
    })
  }

  return function middleware (req, res, next) {
    if (development) {
      if (devMiddleware) {
        // If devMiddleware exists, use it as middleware.
        devMiddleware(req, res, next)
      } else {
        // Notify the user that the middleware is waiting until after the hot
        // client server is listening before handling requests.
        logger.info('Waiting for the Hot Client server to start listening...')

        // Check for the devMiddleware to be defined in 100ms intervals up until
        // the max number of attempts is reached.
        let attempts = 0
        let serverCheckInterval = setInterval(() => {
          attempts++
          if (devMiddleware) {
            clearInterval(serverCheckInterval)
            devMiddleware(req, res, next)
          } else if (attempts === serverCheckAttempts) {
            clearInterval(serverCheckInterval)
            next(serverCheckErr)
          }
        }, 100)
      }
    } else {
      next()
    }
  }
}
