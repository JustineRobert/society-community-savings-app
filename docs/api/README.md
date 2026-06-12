# Community Savings App Backend

## Development

To start the development server with automatic restarts on file changes:

```bash
nodemon server.js
```

This uses the configuration in `nodemon.json` for optimal development experience, including a 1-second delay to prevent rapid restarts and memory settings for large heaps.

## Production

For production, use:

```bash
node server.js
```

## Notes

- Port: 5000 (configurable via `PORT` env var)
- Handles `EADDRINUSE` by retrying on the next port if needed
- Graceful shutdown on SIGINT/SIGTERM
