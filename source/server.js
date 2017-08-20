import 'babel-polyfill';
import request from 'request-promise';
import { resolve } from 'path';
import uuid from 'uuid';
import jwt from 'jwt-builder';
import restify from 'restify';
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

const {name, version} = require('../package.json');
const PORT = process.env.PORT || 3006;

const server = restify.createServer({name, version});
server.use(restify.plugins.acceptParser(server.acceptable));
server.use(restify.plugins.queryParser());
server.use(restify.plugins.bodyParser());
server.use(restify.plugins.gzipResponse());
server.use(cookieParser.parse);
server.use(sessions({
  cookieName: 'session',
  secret: 'blargadeeblargblarg',
  duration: 24 * 60 * 60 * 1000,
  activeDuration: 1000 * 60 * 5
}));

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

  const client_id = process.env.TOKEN_SERVICE_OPEN;
  const state = uuid.v4();
  const url = config.githubAuthURL;
  const redirect_uri = config.tokenService;
  const scope = 'read:org';

  req.session.referrer = req.headers.referrer || req.headers.referer;

  console.log('referrer: ', req.session.referrer);

  req.session.state = state;
  console.log('session a: ', req.session);

  res.redirect(`${url
    }?client_id=${client_id
    }&redirect_uri=${redirect_uri
    }&scope=${scope
    }&state=${state}`, next);

});

server.get('/generate/', async (req, res, next)=>{

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
      Accept: 'application/json',
      'User-Agent': 'FM-App',
    },
    json: true
  });

  profile.token = answer.access_token

  const user = await request({
    method: 'GET',
    uri: `${config.githubAPI}user`,
    headers: {
      Authorization: `token ${profile.token}`,
      'User-Agent': 'FM-App',
      Accept: 'application/json',
    },
    json: true
  });

  profile.login = user.login;

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
  profile.isTeam = (isTeamResponce.statusCode === 200);
  if (profile.isTeam) {

    profile.isOwner = (isTeamResponce.body.role === 'admin');

    try {
      const isAuthorRequest = await request({
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
    const isDeveloperRequest = await request({
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
    const isEditorRequest = await request({
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
    const isStafferRequest = await request({
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
    const isTranslatorRequest = await request({
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
  console.log('profile: ', profile);

  res.redirect(302, (req.session.referrer === undefined) ? 'https://admin.frontender.info/' : req.session.referrer, next);
});

server.listen(PORT, ()=> {
  console.log('%s listening at %s', server.name, server.url);
});
