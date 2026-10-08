import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import handler from './routes.js';

dotenv.config();

const app = express();

app.use(cors());

// In order to make it work seamlessly with routes.js which expects a raw Node.js req,
// we'll pass requests without fully consuming the body if possible, or just let routes.js handle it.
// routes.js uses bodyJson(req) which does: let body=''; for await (const chunk of req) body += chunk;
// Express consumes the stream if we use express.json(), breaking bodyJson(req).
// So we won't use express.json() for /api routes.
app.use('/api', (req, res) => {
    handler(req, res);
});

const port = process.env.API_PORT || 3001;
app.listen(port, () => {
    console.log(`LifeOS Express API listening on port ${port}`);
});
