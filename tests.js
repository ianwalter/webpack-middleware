const { test } = require('@ianwalter/bff')
const createTestServer = require('@ianwalter/test-server')
const c2k = require('koa-connect')
const webpackMiddleware = require('.')

test('middleware', async () => {
  const server = await createTestServer()
  server.use(c2k(webpackMiddleware))
})
