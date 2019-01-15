module.exports = {
  'env': {
    'node': true,
    'jasmine': true
  },
  'extends': 'standard',
  'plugins': ['eslint-plugin-jasmine'],
  'rules': {
    'indent': ['error', 2],
    'semi': [2, 'always'],
    'no-extra-semi': 2,
    'camelcase': 'off',
    'prefer-promise-reject-errors': 'off'
  }
};
