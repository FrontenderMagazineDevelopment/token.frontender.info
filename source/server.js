import 'babel-polyfill';
import request from 'request-promise';
import { resolve } from 'path';
import uuid from 'uuid';
import jwt from 'jwt-builder';
import restify from 'restify';
// import restifySession from 'restify-session';
import cookieParser from 'restify-cookies';
import dotenv from 'dotenv';
import fs from 'fs';

const CONFIG_DIR = '../config/';
const ENV_PATH = resolve(__dirname, '../../.env');
const CONFIG_PATH = resolve(__dirname, `${CONFIG_DIR}application.${(process.env.NODE_ENV || 'local')}.json`);
const sessions = require("client-sessions");

if (!fs.existsSync(ENV_PATH)) throw new Error('Envirnment files not found');
dotenv.config({ path: ENV_PATH });

if (!fs.existsSync(CONFIG_PATH)) throw new Error('Config not found');
const config = require(CONFIG_PATH);

console.log('config: ', CONFIG_PATH);
console.log('env: ', ENV_PATH);
console.log('CHALLENGE_BASE: ', process.env.CHALLENGE_BASE);

// const session = restifySession({
//   debug : true,
//   ttl   : 2
// });

const {name, version} = require('../package.json');
const PORT = process.env.PORT || 3006;

const server = restify.createServer({name, version});
server.use(restify.plugins.acceptParser(server.acceptable));
server.use(restify.plugins.queryParser());
server.use(restify.plugins.bodyParser());
server.use(restify.plugins.gzipResponse());
server.use(cookieParser.parse);
server.use(sessions({
  cookieName: 'session', // cookie name dictates the key name added to the request object
  secret: 'blargadeeblargblarg', // should be a large unguessable string
  duration: 24 * 60 * 60 * 1000, // how long the session will stay valid in ms
  activeDuration: 1000 * 60 * 5 // if expiresIn < activeDuration, the session will be extended by activeDuration milliseconds
}));
// server.use(session.sessionManager);

server.pre(function(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.charSet('utf-8');
  return next();
});

server.get('/.well-known/acme-challenge/.*/', restify.plugins.serveStatic({
  directory: process.env.CHALLENGE_BASE,
  index: false,
}));

server.get('/', (req, res, next)=>{

  console.log('session a: ', req.session);

  const client_id = process.env.TOKEN_SERVICE_OPEN;
  const state = uuid.v4();
  const url = config.githubAuthURL;
  const redirect_uri = config.tokenService;
  const scope = 'read:org';

  req.session.referer = req.headers.referer;
  req.session.state = state;

  res.redirect(`${url
    }?client_id=${client_id
    }&redirect_uri=${redirect_uri
    }&scope=${scope
    }&state=${state}`, next);

});

server.get('/generate/', async (req, res, next)=>{

  console.log('session b: ', req.session);

  if (req.session.state !== req.query.state) {
    res.status(401);
    const data = {
      session: req.session,
      body: req.body,
      query: req.query,
      params: req.params
    };
    res.send(data);
    res.end();
  }
  const answer = await request({
    method: 'POST',
    uri: config.githubAuthToken,
    body: {
      client_id: process.env.TOKEN_SERVICE_OPEN,
      client_secret: process.env.TOKEN_SERVICE_SECRET,
      code: req.query.code,
      state: req.query.state,
    },
    headers: {
      Accept: 'application/json',
    },
    json: true
  });

  console.log('answer: ', answer);

  req.session.access_token = answer.access_token;
  req.session.token_type = answer.token_type;
  req.session.scope = answer.scope;

  const data = {
    session: req.session,
    body: req.body,
    query: req.query,
    params: req.params
  };

  res.status(200);
  res.send(data);
  res.end();

  // res.writeHead(302, { location: (req.session.referer === '') ? 'https://admin.frontender.info/' : req.session.referer });
});

server.listen(PORT, ()=> {
  console.log('%s listening at %s', server.name, server.url);
});
