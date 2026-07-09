/** @type {import('ts-jest').JestConfigWithTsJest} */
// Espelha a config da API (apps/api/jest.config.js) para manter um unico
// padrao de teste no monorepo. Os specs deste pacote cobrem a logica
// ISOMORFICA (validacao de respostas) que roda no navegador e na API.
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
};
