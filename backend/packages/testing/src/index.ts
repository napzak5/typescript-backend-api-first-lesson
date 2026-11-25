// The PostgreSQL of the tests, and their databases
export {
  openTestDatabases,
  type TestDatabase,
  type TestDatabaseOptions,
  type TestDatabases,
} from './postgres/databases'
export { startTestPostgres, type TestPostgres } from './postgres/instance'
export {
  type CurrentTestDatabase,
  useTestDatabases,
} from './postgres/use-test-databases'

// The object storage of the tests
export {
  startTestStorage,
  type TestStorage,
  type TestStorageSettings,
} from './storage/seaweedfs'
