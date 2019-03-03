import fs from 'fs';
import { resolve } from 'path';
import restify from 'restify';
import cookieParser from 'restify-cookies';
import dotenv from 'dotenv';
import get from './routes/get';
import getToken from './routes/token/get';

const session = require('express-session');
const MongoStore = require('connect-mongo')(session);

const ENV_PATH_CURRENT = resolve(__dirname, '../.env');
const ENV_PATH_PARENT = resolve(__dirname, '../../.env');

const isCurrent = fs.existsSync(ENV_PATH_CURRENT);
const isParent = fs.existsSync(ENV_PATH_PARENT);

if (!isCurrent && !isParent) throw new Error('Envirnment files not found');

if (isCurrent) dotenv.config({ path: ENV_PATH_CURRENT });
if (isParent) dotenv.config({ path: ENV_PATH_PARENT });

dotenv.config();

const {
  MONGODB_PORT,
  MONGODB_HOST,
  MONGODB_NAME,
  COOKIE_SECRET,
} = process.env;

const { name, version } = require('../package.json');

const PORT = process.env.PORT || 3054;
const server = restify.createServer({ name, version });

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

server.listen(PORT);
