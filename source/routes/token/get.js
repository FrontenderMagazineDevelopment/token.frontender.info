import jwt from 'jwt-builder';
import request from 'request-promise';

export default async (req, res, next) => {
  const {
    DOMAIN,
    TEAMS_DEVELOPER,
    TEAMS_TRANSLATOR,
    TEAMS_AUTHOR,
    TEAMS_EDITOR,
    TEAMS_STAFFER,
    JWT_SECRET,
    DEFAULT_REDIRECT,
    COOKIE_DOMAIN,
    ORG_NAME,
    GITHUB_API,
    GITHUB_AUTH_URL,
    GITHUB_AUTH_TOKEN,
    TOKEN_SERVICE_OPEN,
    TOKEN_SERVICE_SECRET,
  } = process.env;

  if (req.session === undefined) {
    res.status(400);
    res.end();
    return;
  }

  console.log('req.session: ', req.session);

  if (req.session.state !== req.query.state) {
    res.status(401);
    res.end();
    return;
  }

  console.log('GITHUB_AUTH_URL: ', GITHUB_AUTH_URL, {
    client_id: TOKEN_SERVICE_OPEN,
    client_secret: TOKEN_SERVICE_SECRET,
    code: req.query.code,
    state: req.query.state,
  });

  let token;
  try {
    console.log('request: ', {
      method: 'POST',
      uri: GITHUB_AUTH_TOKEN,
      body: {
        client_id: TOKEN_SERVICE_OPEN,
        client_secret: TOKEN_SERVICE_SECRET,
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
    const answer = await request({
      method: 'POST',
      uri: GITHUB_AUTH_TOKEN,
      body: {
        client_id: TOKEN_SERVICE_OPEN,
        client_secret: TOKEN_SERVICE_SECRET,
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
    console.log('answer: ', answer);
    token = answer.access_token;
    delete req.session.state;
  } catch (error) {
    console.log('error: ', error.message);
    res.status(500);
    res.end();
  }

  const profile = {};

  const user = await request({
    method: 'GET',
    uri: `${GITHUB_API}user`,
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
      uri: `${GITHUB_API}orgs/${ORG_NAME}/memberships/${profile.login}`,
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
        uri: `${GITHUB_API}teams/${TEAMS_AUTHOR}/members/${profile.login}`,
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
        uri: `${GITHUB_API}teams/${TEAMS_DEVELOPER}/members/${profile.login}`,
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
        uri: `${GITHUB_API}teams/${TEAMS_EDITOR}/members/${profile.login}`,
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
        uri: `${GITHUB_API}teams/${TEAMS_STAFFER}/members/${profile.login}`,
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
        uri: `${GITHUB_API}teams/${TEAMS_TRANSLATOR}/members/${profile.login}`,
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
    secret: JWT_SECRET,
    nbf: 0,
    iat: new Date().getTime(),
    exp: 86400,
    iss: `https://${DOMAIN}/`,
    scope: profile,
  });

  res.setCookie('token', jwtToken, {
    path: '/',
    domain: COOKIE_DOMAIN,
    maxAge: 86400,
  });
  res.redirect(req.session.to || DEFAULT_REDIRECT, next);
};
