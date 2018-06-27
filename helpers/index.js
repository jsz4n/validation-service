import { insertNewError, insertNewErrors } from '../lib/validation-error';
import { querySudo, updateSudo } from '../lib/auth-sudo';
import { validateSparqlSelect, validateSparqlAsk } from './sparql-validation.js';

export {
  validateSparqlSelect,
  validateSparqlAsk,
  insertNewError, insertNewErrors,
  querySudo, updateSudo
}
