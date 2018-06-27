import { insertNewError, insertNewErrors, querySudo as query } from './';

/**
 * Helper function to make a validation rule using a SPARQL SELECT query
 * The validation is considered invalid if the query returns any result.
 * Each entry in the result set is stored as a validation error in the store.
 * 
 * The error message per entry is constructed by calling the validation's message function
 * passing the result bindings of the SELECT query as a params object.
 * E.g. { "s": "http://data.lblod.info/id/mandataris/123", "start": "01-12-2018" }
 * These values can then be used to construct the error message.
 *
 * @param {string} sparqlQuery SPARQL SELECT query to use for validation
 *
 * @return {function} Validate function using the SPARQL select query
*/
const validateSparqlSelect = function(sparqlQuery) {
  return async function(execution) {
    try {
      console.log('Executing SPARQL SELECT validation');
      const queryResult = await query(sparqlQuery);
      
      const validationErrors = queryResult.results.bindings;
      if (!validationErrors.length) {
        return true;
      } else {
        console.log(`Got ${validationErrors.length} errors for validation ${this.name}`);
        const errors = validationErrors.map((binding) => {
          const params = constructParamsFromResultBinding(binding);
          const message = typeof(this.message) == 'function' ? this.message(params) : this.message;
          return { executionUri: execution.uri, validationUri: this.uri, message };
        });
        // TODO add bindings as parameters to the errors
        return await insertNewErrors(errors);
      };
    } catch (e) {
      console.log(`Error during SPARQL select query validation ${this.name}: ${e}`);
      throw e;
    }
  };
};

/**
 * Helper function to make a validation rule using a SPARQL ASK query
 * The validation is considered invalid if the query returns 'false'.
 * In that case one validation error is written to the store.
 * The error message of the validation may be a static string or a parameterless function.
 *
 * @param {string} sparqlQuery SPARQL ASK query to use for validation
 *
 * @return {function} Validate function using the SPARQL ask query
*/
const validateSparqlAsk = function(sparqlQuery) {
  return async function(execution) {
    try {
      console.log('Executing SPARQL ASK validation');    
      const queryResult = await query(sparqlQuery);

      if (!queryResult.boolean) {
        const message = typeof(this.message) == 'function' ? this.message() : this.message;
        return [await insertNewError(execution.uri, this.uri, message)];
      }
      return [];
    } catch (e) {
      console.log(`Error during SPARQL ask query validation ${this.name}: ${e}`);
      throw e;
    }
  };
};

/**
 * Construct a simple object from a SPARQL result binding
 * 
 * @param {Object} binding SPARQL result binding to transform
 *
 * @return {Object} Simple params object mapping variable names to their raw value
 *                  E.g. { "s": "http://data.lblod.info/id/mandataris/123", "start": "01-12-2018" }
*/
function constructParamsFromResultBinding(binding) {
  const params = {};
  Object.keys(binding).forEach( key => params[key] = binding[key].value );
  return params;
}

export {
  validateSparqlSelect,
  validateSparqlAsk
}
