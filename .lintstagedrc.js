const path = require("path");

const buildNextEslintCommand = filenames =>
  `yarn workspace @se-2/nextjs eslint --fix ${filenames
    .map(f => path.relative(path.join("packages", "nextjs"), f))
    .join(" ")}`;

const checkTypesNextCommand = () => "yarn next:check-types";

// forge fmt takes paths relative to packages/foundry/ (its own cwd via the
// yarn workspace), same relative-path pattern as the eslint command above.
const buildForgeFmtCommand = filenames =>
  `yarn workspace @se-2/foundry exec forge fmt ${filenames
    .map(f => path.relative(path.join("packages", "foundry"), f))
    .join(" ")}`;

module.exports = {
  "packages/nextjs/**/*.{ts,tsx}": [buildNextEslintCommand, checkTypesNextCommand],
  "packages/foundry/**/*.sol": [buildForgeFmtCommand],
};
