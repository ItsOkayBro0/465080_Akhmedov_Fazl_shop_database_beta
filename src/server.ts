import { startServer } from '~/app.ts';
import { environment } from '~/env.ts';

const server = startServer(environment.PORT);
console.log(`Магазин запущен на ${server.url}`);
