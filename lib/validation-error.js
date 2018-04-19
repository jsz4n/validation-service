import { uuid, update, sparqlEscapeUri, sparqlEscapeString } from 'mu';

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
    WITH ${sparqlEscapeUri(process.env.MU_APPLICATION_GRAPH)}
    INSERT DATA {
      ${sparqlEscapeUri(uri)} a validation:Error ;
        mu:uuid ${sparqlEscapeString(id)} ;
        validation:producedBy ${sparqlEscapeUri(executionUri)} ;
        validation:validation ${sparqlEscapeUri(validationUri)} ; 
        validation:message ${sparqlEscapeString(message)} .
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
  insertNewError
}
