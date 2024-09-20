module.exports = {
  parser: '@babel/eslint-parser',
  parserOptions: {
    requireConfigFile: false
  },
  env: {
    node: true,
    jest: true
  },
  extends: 'standard',
  rules: {
    indent: ['error', 2],
    semi: [2, 'always'],
    'no-extra-semi': 2,
    camelcase: 'off',
    quotes: ['error', 'single', { allowTemplateLiterals: true }]
  }
};
