import { uuid, sparqlEscapeUri, sparqlEscapeString } from 'mu';
import { updateSudo as update } from './auth-sudo';

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

     INSERT DATA {
       GRAPH ${sparqlEscapeUri(process.env.MU_APPLICATION_GRAPH)} {
         ${sparqlEscapeUri(validationUri)} a validation:Validation ;
            mu:uuid ${sparqlEscapeString(validationId)} ;
            validation:name ${sparqlEscapeString(validation.name)} ;
            validation:description ${sparqlEscapeString(validation.description)} ;
            validation:status ${sparqlEscapeString(status)} .
         ${sparqlEscapeUri(executionUri)} validation:performsValidation ${sparqlEscapeUri(validationUri)} .
       }
     }`);

  validation.uri = validationUri;
  return validation;
}

/**
 * Finish the given validation.
 * Changes the validation state to one of 'validation-failed', 'validation-succeeded' or 'failed'.
 *
 * @param {Object} validation Validation to finish
 * @param {Array} errors Array of validation errors
 * @param {boolean} success Whether the execution of the validation finished successfully
 *
 * @return {Object} A validation with a URI
*/
async function finishValidation(validation, errors, success = true) {
  let status;
  if (success) {
    status = errors.length ? 'validation-failed' : 'validation-succeeded';
  } else {
    status = 'failed';
  }

  await update(`
    PREFIX validation: <http://mu.semte.ch/vocabularies/validation/>

    DELETE {
      GRAPH ${sparqlEscapeUri(process.env.MU_APPLICATION_GRAPH)} {
        ${sparqlEscapeUri(validation.uri)} validation:status ?status .
      }
    } WHERE {
      GRAPH ${sparqlEscapeUri(process.env.MU_APPLICATION_GRAPH)} {
        ${sparqlEscapeUri(validation.uri)} a validation:Validation ;
                                         validation:status ?status .
      }
    }

    ;

    INSERT DATA {
      GRAPH ${sparqlEscapeUri(process.env.MU_APPLICATION_GRAPH)} {
        ${sparqlEscapeUri(validation.uri)} validation:status ${sparqlEscapeString(status)} .
      }
    }
 `);
}

export {
  insertNewValidation,
  finishValidation
}
