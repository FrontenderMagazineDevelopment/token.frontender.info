import 'babel-polyfill';
import request from 'request-promise';
import { resolve } from 'path';
import uuid from 'uuid';
import jwt from 'jwt-builder';
import restify from 'restify';
import cookieParser from 'restify-cookies';
import dotenv from 'dotenv';
import fs from 'fs';

const ENV_PATH = resolve(__dirname, '../../.env');
const CONFIG_DIR = '../config/';
const CONFIG_PATH = resolve(__dirname, `${CONFIG_DIR}application.${(process.env.NODE_ENV || 'local')}.json`);
const sessions = require('client-sessions');

if (!fs.existsSync(ENV_PATH)) throw new Error('Envirnment files not found');
dotenv.config({ path: ENV_PATH });

if (!fs.existsSync(CONFIG_PATH)) throw new Error('Config not found');
const config = require(CONFIG_PATH);
const { name, version } = require('../package.json');

const PORT = process.env.PORT || 3030;

const server = restify.createServer({ name, version });
server.use(restify.plugins.acceptParser(server.acceptable));
server.use(restify.plugins.queryParser());
server.use(restify.plugins.bodyParser());
server.use(restify.plugins.gzipResponse());
server.use(cookieParser.parse);
server.use(sessions({
  cookieName: 'session',
  secret: process.env.COOKIE_SECRET,
  duration: 60 * 60,
  activeDuration: 60 * 5,
}));

server.pre((req, res, next) => {
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

server.get('/auth/', (req, res, next) => {
  const clientId = process.env.TOKEN_SERVICE_OPEN;
  const state = uuid.v4();
  const url = config.githubAuthURL;
  const redirectUri = config.tokenService;
  const scope = 'read:org';

  req.session.referrer = req.headers.referrer || req.headers.referer;
  req.session.state = state;

  res.redirect(`${url
    }?client_id=${clientId
    }&redirect_uri=${redirectUri
    }&scope=${scope
    }&state=${state}`, next);
});

server.get('/token/', async (req, res, next) => {
  const profile = {};

  if (req.session.state !== req.query.state) {
    res.status(401);
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
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: 0,
      Accept: 'application/json',
      'User-Agent': 'FM-App',
    },
    json: true,
  });

  profile.token = answer.access_token;

  const user = await request({
    method: 'GET',
    uri: `${config.githubAPI}user`,
    headers: {
      Authorization: `token ${profile.token}`,
      'User-Agent': 'FM-App',
      Accept: 'application/json',
    },
    json: true,
  });

  profile.login = user.login;
  profile.blog = user.blog;
  profile.email = user.email;

  try {
    const isTeamResponce = await request({
      method: 'GET',
      uri: `${config.githubAPI}orgs/${config.orgName}/memberships/${profile.login}`,
      headers: {
        Authorization: `token ${profile.token}`,
        'User-Agent': 'FM-App',
        Accept: 'application/json',
      },
      json: true,
      resolveWithFullResponse: true,
    });
    profile.isTeam = true;
    profile.isOwner = (isTeamResponce.body.role === 'admin');
  } catch (error) {
    profile.isTeam = false;
    profile.isOwner = false;
  }

  if (profile.isTeam) {
    try {
      await request({
        method: 'HEAD',
        uri: `${config.githubAPI}teams/${config.teams.author}/members/${profile.login}`,
        headers: {
          Authorization: `token ${profile.token}`,
          'User-Agent': 'FM-App',
          Accept: 'application/json',
        },
        resolveWithFullResponse: true,
      });
      profile.isAuthor = true;
    } catch (error) {
      profile.isAuthor = false;
    }

    try {
      await request({
        method: 'HEAD',
        uri: `${config.githubAPI}teams/${config.teams.developer}/members/${profile.login}`,
        headers: {
          Authorization: `token ${profile.token}`,
          'User-Agent': 'FM-App',
          Accept: 'application/json',
        },
        resolveWithFullResponse: true,
      });
      profile.isDeveloper = true;
    } catch (error) {
      profile.isDeveloper = false;
    }

    try {
      await request({
        method: 'HEAD',
        uri: `${config.githubAPI}teams/${config.teams.editor}/members/${profile.login}`,
        headers: {
          Authorization: `token ${profile.token}`,
          'User-Agent': 'FM-App',
          Accept: 'application/json',
        },
        resolveWithFullResponse: true,
      });
      profile.isEditor = true;
    } catch (error) {
      profile.isEditor = false;
    }

    try {
      await request({
        method: 'HEAD',
        uri: `${config.githubAPI}teams/${config.teams.staffer}/members/${profile.login}`,
        headers: {
          Authorization: `token ${profile.token}`,
          'User-Agent': 'FM-App',
          Accept: 'application/json',
        },
        resolveWithFullResponse: true,
      });
      profile.isStaffer = true;
    } catch (error) {
      profile.isStaffer = false;
    }

    try {
      await request({
        method: 'HEAD',
        uri: `${config.githubAPI}teams/${config.teams.translator}/members/${profile.login}`,
        headers: {
          Authorization: `token ${profile.token}`,
          'User-Agent': 'FM-App',
          Accept: 'application/json',
        },
        resolveWithFullResponse: true,
      });
      profile.isTranslator = true;
    } catch (error) {
      profile.isTranslator = false;
    }
  } else {
    profile.isOwner = false;
    profile.isAuthor = false;
    profile.isDeveloper = false;
    profile.isEditor = false;
    profile.isStaffer = false;
    profile.isTranslator = false;
  }

  const token = jwt({
    algorithm: 'HS256',
    secret: process.env.JWT_SECRET,
    nbf: 0,
    iat: new Date().getTime(),
    exp: 86400,
    iss: 'https://frontender.info/',
    scope: profile,
  });

  res.setCookie('token', token, {
    path: '/',
    domain: '.frontender.info',
    maxAge: 86400,
  });

  res.redirect(303, (req.session.referrer === undefined) ? 'https://admin.frontender.info/' : req.session.referrer, next);
});

server.listen(PORT);
