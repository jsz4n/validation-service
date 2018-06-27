import { uuid, sparqlEscapeUri, sparqlEscapeString } from 'mu';
import { updateSudo as update } from './auth-sudo';

/**
 * Represents a validation error produced by an execution
 *
 * @class ValidationError
*/
class ValidationError {
  // uri: null
  // id: null
  // message: null
  // executionUri: null,
  // validationUri: null
  constructor(content) {
    for( var key in content )
      this[key] = content[key];
  }
}

/**
 * Insert new validation errors in the store in bulk
 *
 * @param {Array} errors Array of validation errors. Each error must consist of an executionUri, validationUri and a message.
 * @return {Array} An array of new validation errors with a URI
 */
async function insertNewErrors(errors) {
  let validationErrors = [];

  const batchSize = 250;
  for (let i = 0; i < errors.length; i += batchSize) {
    const errorBatch = errors.slice(i, i + batchSize);
    let sparqlInsertData = '';
    const validationErrorBatch = errorBatch.map( async (err) => {
      const id = uuid();
      const uri = `http://mu.semte.ch/services/validation-service/errors/${id}`;

      if (err.executionUri && err.validationUri && err.message) {
        sparqlInsertData += `${sparqlEscapeUri(uri)} a validation:Error ; mu:uuid ${sparqlEscapeString(id)} ; validation:producedBy ${sparqlEscapeUri(err.executionUri)} ; validation:validation ${sparqlEscapeUri(err.validationUri)} ; validation:message ${sparqlEscapeString(err.message)} .`;
      } else {
        console.error(`Error must have an executionUri, validationUri and message. This error will not be persisted.`);
      }

      return new ValidationError({
        uri,
        id,
        message: err.message,
        executionUri: err.executionUri,
        validationUri: err.validationUri
      });
    });

    await update(`
      PREFIX validation: <http://mu.semte.ch/vocabularies/validation/>
      PREFIX mu: <http://mu.semte.ch/vocabularies/core/>

      INSERT DATA {
        GRAPH ${sparqlEscapeUri(process.env.MU_APPLICATION_GRAPH)} {
          ${sparqlInsertData}
        }
      }`);

    validationErrors = validationErrors.concat(validationErrorBatch);
  };

  return validationErrors;
};

/**
 * Insert a new validation error in the store
 *
 * @param {string} executionUri URI of the execution that produced the validation error
 * @param {string} validationURI URI of the validation that failed
 * @param {string} message Validation error message
 * @return {ValidationError} A new validation error
 */
async function insertNewError(executionUri, validationUri, message) {
  const id = uuid();
  const uri = `http://mu.semte.ch/services/validation-service/errors/${id}`;

  await update(`
    PREFIX validation: <http://mu.semte.ch/vocabularies/validation/>
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>

    INSERT DATA {
      GRAPH ${sparqlEscapeUri(process.env.MU_APPLICATION_GRAPH)} {
        ${sparqlEscapeUri(uri)} a validation:Error ;
          mu:uuid ${sparqlEscapeString(id)} ;
          validation:producedBy ${sparqlEscapeUri(executionUri)} ;
          validation:validation ${sparqlEscapeUri(validationUri)} ;
          validation:message ${sparqlEscapeString(message)} .
      }
    }`);

  return new ValidationError({
    uri,
    id,
    message,
    executionUri,
    validationUri
  });
};

export default ValidationError;
export {
  insertNewError,
  insertNewErrors
}
