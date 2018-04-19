import { uuid, query, update, sparqlEscapeString, sparqlEscapeUri, sparqlEscapeDateTime } from 'mu';
import { insertNewValidation, finishValidation } from './validation';

/**
 * Represents the execution of a given set of validations
 * Status of an execution is one of "ongoing", "done", "failed", "canceled"
 * 
 * @class Execution
*/
class Execution {
  // uri: null
  // id: null
  // status: null
  // created: null
  // validationSet: null
  constructor(content) {
    for( var key in content )
      this[key] = content[key];
  }

  /**
   * Execute the given set validations and write the results to the store
   * @method perform
   * @param {Array} validations Array of validations to execute
  */
  async perform(validations) {
    try {
      const report = [];
      
      const promises = validations.map(async (validation) => {
        try {
          await insertNewValidation(validation, this.uri);
          const isValid = await validation.validate(this);
          report.push({ validation, isValid });
          return finishValidation(validation);
        } catch(e) {
          console.error(`Error while executing validation ${validation.name}: ${e}`);
          report.push({ validation, isValid: false });          
          return finishValidation(validation, false);
        }
      });

      await Promise.all(promises);

      console.log(`=== Validation report of execution ${this.uri}  ===`);
      report.forEach(v => console.log(`[${v.isValid ? 'SUCCESS' : 'FAILED'}] ${v.validation.name}`));
      console.log('======');
      
      await finishExecution(this.id);
    } catch(e) {
      console.error(`Error during execution ${this.id}: ${e}`);      
      await finishExecution(this.id, false);
    }
  }
  
  /** 
   * Wrap execution in a JSONAPI compliant object
   *
   * @method toJsonApi
   * @return {Object} JSONAPI compliant wrapper for the execution
   */
  toJsonApi() {
    return {
      data: {
        type: 'executions',
        id: this.id,
        attributes: {
          uri: this.uri,
          status: this.status,
          created: this.created,
          'validation-set': this.validationSet
        }
      }
    };
  }  
}

/**
 * Insert a new ongoing execution in the store
 *
 * @param {string} validationSetUri Optional URI of the validation set that must be executed.
 *
 * @return {Execution} A new execution
 */
async function insertNewExecution(validationSetUri) {
  const executionId = uuid();
  const executionUri = `http://mu.semte.ch/services/validation-service/executions/${executionId}`;
  const created = new Date();

  const validationSetProp = validationSetUri ? `validation:validationSet ${sparqlEscapeUri(validationSetUri)} ;` : '';
  await update(
    `PREFIX validation: <http://mu.semte.ch/vocabularies/validation/>
     PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
     PREFIX dct: <http://purl.org/dc/terms/>

     WITH ${sparqlEscapeUri(process.env.MU_APPLICATION_GRAPH)}
     INSERT DATA { 
       ${sparqlEscapeUri(executionUri)} a validation:Execution ; 
            mu:uuid ${sparqlEscapeString(executionId)} ;
            validation:status "ongoing" ;
            ${validationSetProp}
            dct:created ${sparqlEscapeDateTime(created)} .
     }`);

  return new Execution({
    uri: executionUri,
    id: executionId,
    status: "ongoing",
    created
  });
}

/**
 * Finish execution with the given uuid
 *
 * @param {string} uuid uuid of the execution
 * @param {boolean} success whether the execution finished successfully
 */ 
async function finishExecution(uuid, success = true) {
  const status = success ? 'done' : 'failed';
  await update(
    `PREFIX validation: <http://mu.semte.ch/vocabularies/validation/>
     PREFIX mu: <http://mu.semte.ch/vocabularies/core/>

     WITH ${sparqlEscapeUri(process.env.MU_APPLICATION_GRAPH)}
     DELETE {
       ?s validation:status ?status .
     }
     INSERT { 
       ?s validation:status ${sparqlEscapeString(status)} .
     } WHERE {
       ?s a validation:Execution ; 
            mu:uuid ${sparqlEscapeString(uuid)} ;
            validation:status ?status .
     }`);
}

/**
 * Get an execution by uuid
 *
 * @param {string} uuid uuid of the execution
 *
 * @return {Execution} Execution with the given uuid. Null if not found.
*/
async function executionByUuid(uuid) {
  const queryResult = await query(
    `PREFIX validation: <http://mu.semte.ch/vocabularies/validation/>
     PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
     PREFIX dct: <http://purl.org/dc/terms/>

     SELECT * 
     WHERE { 
       GRAPH ${sparqlEscapeUri(process.env.MU_APPLICATION_GRAPH)} {
         ?uri a validation:Execution ; 
              mu:uuid ${sparqlEscapeString(uuid)} ;
              validation:status ?status ;
              dct:created ?created .
       }
     }`);

  if (queryResult.results.bindings.length) {
    const result = queryResult.results.bindings[0];
    return new Execution({
      uri: result.uri.value,
      id: uuid,
      status: result.status.value,
      created: result.created.value
    });
  } else {
    return null;
  }
}

/**
 * Cleanup ongoing executions
*/
async function cleanup() {
  await update(
    `PREFIX validation: <http://mu.semte.ch/vocabularies/validation/>
     PREFIX mu: <http://mu.semte.ch/vocabularies/core/>

     WITH ${sparqlEscapeUri(process.env.MU_APPLICATION_GRAPH)}
     DELETE {
       ?s validation:status ?status .
     }
     INSERT { 
       ?s validation:status "cancelled" .
     } WHERE {
       ?s a validation:Execution ; 
            validation:status ?status .

       FILTER(?status = "ongoing")
     }`);
}


export default Execution;
export {
  insertNewExecution,
  finishExecution,
  cleanup,
  executionByUuid
}
