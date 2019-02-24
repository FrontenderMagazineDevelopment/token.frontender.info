import fs from 'fs';
import { resolve } from 'path';
import restify from 'restify';
import cookieParser from 'restify-cookies';
import dotenv from 'dotenv-safe';
import get from './routes/get';
import getToken from './routes/token';

const session = require('express-session');
const RedisStore = require('connect-redis')(session);

const ENV_PATH = resolve(__dirname, '../.env');
if (!fs.existsSync(ENV_PATH)) throw new Error('Envirnment files not found');
dotenv.config({ path: ENV_PATH });
const CONFIG_DIR = '../config/';
const CONFIG_PATH = resolve(
  __dirname,
  `${CONFIG_DIR}application.${process.env.NODE_ENV || 'local'}.json`,
);
if (!fs.existsSync(CONFIG_PATH)) throw new Error(`Config not found: ${CONFIG_PATH}`);
const config = require(CONFIG_PATH); // eslint-disable-line
process.env.config = config;

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
  saveUninitialized: true,
  resave: false,
  cookie: {
    secure: false,
  },
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

console.log('Listening: ', PORT);
server.listen(PORT);
