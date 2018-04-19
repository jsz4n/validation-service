import { uuid, update, sparqlEscapeUri, sparqlEscapeString } from 'mu';

/** 
 * Insert a new validation linked to the given execution in the store
 * 
 * @param {Object} validation Validation to insert
 * @param {string} executionUri URI of the execution to link the validation to
 *
 * @return {Object} A validation with a URI
*/
async function insertNewValidation(validation, executionUri) {
  const validationId = uuid();
  const validationUri = `http://mu.semte.ch/services/validation-service/validations/${validationId}`;
  const status = 'ongoing';

  await update(
    `PREFIX validation: <http://mu.semte.ch/vocabularies/validation/>
     PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
     PREFIX dct: <http://purl.org/dc/terms/>

     WITH ${sparqlEscapeUri(process.env.MU_APPLICATION_GRAPH)}
     INSERT DATA { 
       ${sparqlEscapeUri(validationUri)} a validation:Validation ; 
            mu:uuid ${sparqlEscapeString(validationId)} ;
            validation:name ${sparqlEscapeString(validation.name)} ;
            validation:description ${sparqlEscapeString(validation.description)} ;
            validation:status ${sparqlEscapeString(status)} .
       ${sparqlEscapeUri(executionUri)} validation:performsValidation ${sparqlEscapeUri(validationUri)} .
     }`);

  validation.uri = validationUri;
  return validation;
}

/** 
 * Finish the given validation.
 * The status of the validation doesn't represent the validity of the data.
 * It just represents the execution status of the validation.
 * 
 * @param {Object} validation Validation to finish
 * @param {boolean} success Whether the execution of the validation finished successfully
 *
 * @return {Object} A validation with a URI
*/
async function finishValidation(validation, success = true) {
  const status = success ? 'done' : 'failed';
  
  await update(`
    PREFIX validation: <http://mu.semte.ch/vocabularies/validation/>

    WITH <${process.env.MU_APPLICATION_GRAPH}>
    DELETE {
      ${sparqlEscapeUri(validation.uri)} validation:status ?status .
    } INSERT {
      ${sparqlEscapeUri(validation.uri)} validation:status ${sparqlEscapeString(status)} .
    } WHERE {
      ${sparqlEscapeUri(validation.uri)} a validation:Validation ;
                                         validation:status ?status .
    }
 `);    
}

export {
  insertNewValidation,
  finishValidation
}
