/**
 * All injection has to go through one container. Importing `di` from the
 * `fudgel` bundle here, and never from `fudgel/dist/di`, keeps a second copy
 * of the injector out of the build.
 */
export { di, diOverride } from 'fudgel';
