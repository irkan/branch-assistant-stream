const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:5679',
      changeOrigin: true,
      pathRewrite: {
        '^/api': '', // Rewrite /api path to empty path
      },
      secure: false,
      logLevel: 'debug',
      onProxyReq: (proxyReq, req, res) => {
        // Log the original request URL and the proxied request URL
        console.log('Original request URL:', req.url);
        console.log('Proxied request URL:', proxyReq.path);
      },
      onProxyRes: (proxyRes, req, res) => {
        // Log the proxy response details
        console.log(`Proxy response status: ${proxyRes.statusCode} for ${req.url}`);
        console.log('Proxy response headers:', proxyRes.headers);
      },
      onError: (err, req, res) => {
        console.error('Proxy error:', err);
        res.writeHead(500, {
          'Content-Type': 'application/json',
        });
        res.end(JSON.stringify({ error: 'Proxy error', message: err.message }));
      }
    })
  );
}; 