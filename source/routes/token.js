import jwt from 'jwt-builder';
import request from 'request-promise';
import fs from 'fs';
import { resolve } from 'path';

const CONFIG_DIR = '../../config/';
const CONFIG_PATH = resolve(__dirname, `${CONFIG_DIR}application.${(process.env.NODE_ENV || 'local')}.json`);

if (!fs.existsSync(CONFIG_PATH)) throw new Error('Config not found');
const config = require(CONFIG_PATH); // eslint-disable-line import/no-dynamic-require
console.log('config: ', config);

export default async (req, res, next) => {
  if (req.session === undefined) {
    res.status(400);
    res.end();
    return;
  }

  if (req.session.state !== req.query.state) {
    res.status(401);
    res.end();
    return;
  }

  let token;
  try {
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
    token = answer.access_token;
    delete req.session.state;
  } catch (error) {
    res.status(500);
    res.end();
  }

  const profile = {};

  const user = await request({
    method: 'GET',
    uri: `${config.githubAPI}user`,
    headers: {
      Authorization: `token ${token}`,
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
        Authorization: `token ${token}`,
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
          Authorization: `token ${token}`,
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
          Authorization: `token ${token}`,
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
          Authorization: `token ${token}`,
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
          Authorization: `token ${token}`,
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
          Authorization: `token ${token}`,
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

  const jwtToken = jwt({
    algorithm: 'HS256',
    secret: process.env.JWT_SECRET,
    nbf: 0,
    iat: new Date().getTime(),
    exp: 86400,
    iss: 'https://frontender.info/',
    scope: profile,
  });

  res.setCookie('token', jwtToken, {
    path: '/',
    domain: config.cookieDomain,
    maxAge: 86400,
  });

  console.log('config 2: ', config);
  console.log('path: ', req.session.to || config.defaultRedirect);
  console.log('next: ', typeof next);

  res.redirect(req.session.to || config.defaultRedirect, next);
};
