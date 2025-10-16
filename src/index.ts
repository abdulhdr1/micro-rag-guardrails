import { startServer } from './server';

startServer().catch((error) => {
  console.error('Fatal error starting server:', error);
  process.exit(1);
});
