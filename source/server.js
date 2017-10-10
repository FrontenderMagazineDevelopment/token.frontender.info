import 'babel-polyfill';
import fs from 'fs';
import { resolve } from 'path';
import restify from 'restify';
import cookieParser from 'restify-cookies';
import dotenv from 'dotenv';
import get from './routes/get';
import getToken from './routes/token';

const ENV_PATH = resolve(__dirname, '../../.env');

const session = require('express-session');
const RedisStore = require('connect-redis')(session);

if (!fs.existsSync(ENV_PATH)) throw new Error('Envirnment files not found');
dotenv.config({ path: ENV_PATH });

const { name, version } = require('../package.json');

const PORT = process.env.PORT || 3054;

const server = restify.createServer({ name, version });
server.use(restify.plugins.acceptParser(server.acceptable));
server.use(restify.plugins.queryParser());
server.use(restify.plugins.bodyParser());
server.use(restify.plugins.gzipResponse());
server.use(cookieParser.parse);

server.use(session({
  store: new RedisStore(),
  resave: true,
  saveUninitialized: false,
  secret: process.env.COOKIE_SECRET,
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
