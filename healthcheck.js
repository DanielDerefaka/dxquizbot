/**
 * Simple healthcheck server for Docker
 * Add this code to your index.js file or create a new file and require it
 */
const http = require('http');

// Create a simple health check server
function startHealthCheckServer(port = 3000) {
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ 
        status: 'healthy',
        timestamp: new Date().toISOString()
      }));
    } else {
      res.statusCode = 404;
      res.end('Not found');
    }
  });

  server.listen(port, () => {
    console.log(`Healthcheck server listening on port ${port}`);
  });

  server.on('error', (err) => {
    console.error('Healthcheck server error:', err);
  });

  return server;
}

// Export the function for use in your main file
module.exports = { startHealthCheckServer };

// If this file is run directly, start the server
if (require.main === module) {
  startHealthCheckServer();
}