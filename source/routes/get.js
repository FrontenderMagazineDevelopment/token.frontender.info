import fs from 'fs';
import uuid from 'uuid';
import { resolve } from 'path';

const CONFIG_DIR = '../../config/';
const CONFIG_PATH = resolve(__dirname, `${CONFIG_DIR}application.${(process.env.NODE_ENV || 'local')}.json`);

if (!fs.existsSync(CONFIG_PATH)) throw new Error('Config not found');
const config = require(CONFIG_PATH);

export default (req, res, next) => {
  if (req.url === '/favicon.ico') {
    req.state(204);
    return next();
  }

  const clientId = process.env.TOKEN_SERVICE_OPEN;
  const state = uuid.v4();
  const url = config.githubAuthURL;
  const redirectUri = config.tokenService;
  const scope = 'read:org';

  req.session.to = req.params.to;
  req.session.referrer = req.headers.referrer || req.headers.referer;
  req.session.state = state;

  res.redirect(`${url
    }?client_id=${clientId
    }&redirect_uri=${redirectUri
    }&scope=${scope
    }&state=${state}`, next);
};
