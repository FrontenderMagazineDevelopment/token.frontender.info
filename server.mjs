import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import restify from 'restify';
import cookieParser from 'restify-cookies';
import dotenv from 'dotenv';
import session from 'express-session';
import connectMongo from 'connect-mongo';
import Terminus from "@godaddy/terminus";
import get from './routes/get.mjs';
import getToken from './routes/token/get.mjs';

const { createTerminus } = Terminus;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MongoStore = connectMongo(session);

const ENV_PATH_CURRENT = resolve(__dirname, '../.env');
const ENV_PATH_PARENT = resolve(__dirname, '../../.env');

const isCurrent = fs.existsSync(ENV_PATH_CURRENT);
const isParent = fs.existsSync(ENV_PATH_PARENT);

if (isCurrent) dotenv.config({ path: ENV_PATH_CURRENT });
if (isParent) dotenv.config({ path: ENV_PATH_PARENT });

dotenv.config();

const {
  MONGODB_PORT,
  MONGODB_HOST,
  MONGODB_NAME,
  COOKIE_SECRET,
  NODE_ENV,
} = process.env;

const PORT = process.env.PORT || 3000;
const server = restify.createServer();

server.use(restify.plugins.acceptParser(server.acceptable));
server.use(restify.plugins.queryParser());
server.use(restify.plugins.bodyParser());
server.use(restify.plugins.gzipResponse());
server.use(cookieParser.parse);

server.use(session({
  store: new MongoStore({
    url: `mongodb://${MONGODB_HOST}:${MONGODB_PORT}/${MONGODB_NAME}`,
  }),
  saveUninitialized: true,
  resave: false,
  cookie: {
    secure: false,
  },
  secret: COOKIE_SECRET,
}));

server.pre((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.charSet('utf-8');
  return next();
});

server.get('/', get);
server.get('/token/', getToken);


const serverStarted = server.listen(PORT, (error) => {
  if (error) throw error;
  console.log(`🚀🚀 Ready on http://localhost:${PORT}`);
});

const checkConnections = (resolveConnections, rejectConnections) => {
  // eslint-disable-next-line consistent-return
  serverStarted.getConnections((error, count) => {
    if (error) return rejectConnections();
    if (count === 0 || NODE_ENV === "local") return resolveConnections();

    console.log(`⌛ Waiting for ${count} open connections to finish`);
    setTimeout(checkConnections, 5000, resolveConnections, rejectConnections);
  });
};

createTerminus(serverStarted, {
  signals: ["SIGTERM", "SIGINT"],
  healthChecks: {
    "/health": async () => Promise.resolve({ uptime: process.uptime() }),
    verbatim: true,
  },
  beforeShutdown() {
    console.log(`💀 Received kill signal`);
    return new Promise(checkConnections);
  },
});