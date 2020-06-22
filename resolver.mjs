/* eslint-disable no-shadow */
/* eslint-disable no-param-reassign */
import { fileURLToPath } from 'url';
import { dirname, resolve as resolvePath } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const folders = ['plugins', 'utils', 'schemas'];

/**
 * @param {string} specifier
 * @param {object} context
 * @param {string} context.parentURL
 * @param {string[]} context.conditions
 * @param {function} defaultResolve
 * @returns {object} response
 * @returns {string} response.url
 */
export default async function resolve(specifier, context, defaultResolve) {
  const foldersRegExp = new RegExp(`^@(${folders.join('|')})/`, 'igm');
  // I add this so I may drop .mjs extension for imports that start with a dot or @utils/
  if ((foldersRegExp.test(specifier) || /^\./igm.test(specifier)) && !/.mjs$/igm.test(specifier)) {
    specifier = `${specifier}.mjs`;
  }

  // If import starts with @root/ I need replace it with real path to project root
  if (/^@root\//igm.test(specifier)) {
    specifier = specifier.replace(/^@root\//igm, `${__dirname}/`);
  }

  // Aliases for root directories, defined in the folders variable
  specifier = folders.reduce((specifier, path) => {
    const pathRegExp = new RegExp(`^@${path}/`, 'igm');
    return (pathRegExp.test(specifier) && specifier.replace(pathRegExp, `${resolvePath(__dirname, path)}/`)) || specifier;
  }, specifier);

  return defaultResolve(specifier, context, defaultResolve);
}
