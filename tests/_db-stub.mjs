// Database stub for pure unit tests. Any call is a bug in the test: these
// suites cover pure functions, so reaching the database means the test is
// silently depending on live data.
const boom = () => {
  throw new Error('A unit test reached the database. These suites must stay pure.');
};
export const query = boom;
export const withTransaction = boom;
export const getPool = boom;
export const testConnection = boom;
export class DatabaseUnavailableError extends Error {}
export default { query, withTransaction };
