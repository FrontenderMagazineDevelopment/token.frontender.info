import request from 'request-promise';
import fs from 'fs';
import { resolve } from 'path';

const CONFIG_DIR = '../../config/';
const CONFIG_PATH = resolve(__dirname, `${CONFIG_DIR}application.${(process.env.NODE_ENV || 'local')}.json`);

if (!fs.existsSync(CONFIG_PATH)) throw new Error('Config not found');
const config = require(CONFIG_PATH);

export default async (req, res) => {
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

    res.status(200);
    res.send(token);
    res.end();
  } catch (error) {
    res.status(500);
    res.end();
  }
};
