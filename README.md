# Token microservice

## Dependencies

Sessions are stored in [Redis](https://redis.io/), so you should [install it](https://medium.com/@petehouston/install-and-config-redis-on-mac-os-x-via-homebrew-eb8df9a4f298).

## Configuration

You should add to `.env`:

* TOKEN_SERVICE_SECRET - app secret token
* TOKEN_SERVICE_OPEN - app public token
* JWT_SECRET - password for jwt
* COOKIE_SECRET - password for cookies

`TOKEN_SERVICE_SECRET` and `TOKEN_SERVICE_OPEN` may be generated in your github account.

`JWT_SECRET` and `COOKIE_SECRET` may be random, but should be consistent thru all projects.

## Installation

```bash
npm i
npm build
npm start
```

