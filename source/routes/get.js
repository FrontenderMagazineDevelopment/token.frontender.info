import uuid from 'uuid';

export default (req, res, next) => {
  console.log('GET: /');

  const {
    TOKEN_SERVICE_OPEN,
    GITHUB_AUTH_URL,
    TOKEN_SERVICE,
  } = process.env;

  if (req.query.state !== undefined) {
    req.state(204);
    req.end();
  }

  if (req.url === '/favicon.ico') {
    req.state(204);
    req.end();
  }

  const state = uuid.v4();
  const scope = 'read:org';
  const url = GITHUB_AUTH_URL;
  const redirectUri = TOKEN_SERVICE;
  const clientId = TOKEN_SERVICE_OPEN;

  req.session.referrer = req.headers.referrer || req.headers.referer;
  req.session.to = req.query.to;
  req.session.state = state;

  console.log('req.session: ', req.session);

  console.log(`${url
  }?client_id=${clientId
  }&redirect_uri=${redirectUri
  }&scope=${scope
  }&state=${state}`);

  res.redirect(`${url
  }?client_id=${clientId
  }&redirect_uri=${redirectUri
  }&scope=${scope
  }&state=${state}`, next);
};
