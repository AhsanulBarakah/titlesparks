/**
 * Jest, for the unit tests.
 *
 * `@wordpress/scripts` 37 stopped supplying WordPress defaults for its Jest
 * command — it runs whatever this project configures — so the two settings the
 * suite actually relies on are declared here: the DOM tests need `jsdom`, and
 * the files are ESM with JSX, which needs the Babel transform in
 * `babel.config.js` (`babel-jest` is the transformer that reads it).
 *
 * Everything the suite asserts is the real module graph under `blocks/`, next
 * to the test that names it, so the default `__tests__/*.test.js` match is
 * exactly right.
 *
 * @type {Object}
 */
module.exports = {
	testEnvironment: 'jsdom',
	transform: {
		'^.+\\.[jt]sx?$': 'babel-jest',
	},
};
