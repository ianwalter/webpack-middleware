const { test } = require('@ianwalter/bff')
const { createExpressServer } = require('@ianwalter/test-server')
const webpackMiddleware = require('.')

test('middleware', async () => {
  const server = await createExpressServer()
  server.use(webpackMiddleware)
  await server.close()
})
