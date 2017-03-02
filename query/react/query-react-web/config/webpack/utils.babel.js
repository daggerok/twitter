import { resolve } from 'path';

export const publicPath = '/';
export const pathTo = rel => resolve(process.cwd(), rel);
export const jsonEnv = env => JSON.stringify(env !== 'development' ? 'production' : env);
export const minimize = env => env !== 'development' ? '&minimize' : '';
