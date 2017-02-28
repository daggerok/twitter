const path = require('path');
const pathTo = rel => path.join(process.cwd(), rel);
const jsonEnv = env => JSON.stringify(env !== 'development' ? 'production' : env);

module.exports = {
  pathTo,
  jsonEnv,
};
