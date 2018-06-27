import { app, errorHandler } from 'mu';
import { insertNewExecution, executionByUuid, cleanup } from './lib/execution';
import validations from '/config';

/** Run on startup */
cleanup();

console.log('=== CONFIGURED VALIDATIONS ===');
validations.forEach((v, i) => console.log(`[${i+1}] ${v.name}`));
console.log('===');
// TODO check if validation names have the required name/description fields

/**
 * Triggers an async execution for a validation-set
 *
 * @param {Object} body Request body may optionally define a validation-set.
 *                      Only the validations in the set will be executed.
 *                      E.g. { "validation-set": "http://data.lblod.info/id/validation-set/mandatendatabank" }
 * @return [202] if validation started successfully. Location header contains an endpoint to monitor the execution
*/
app.post('/executions', async function(req, res, next) {
  try {
    let validationSet = validations;
    const validationSetUri = req.body ? req.body['validation-set'] : null;
    if (validationSetUri) {
      const validationSetId = req.body['validation-set'];
      validationSet = validations.filter(val => val.validationSets.includes(validationSetId));
    }

    const execution = await insertNewExecution(validationSetUri);

    execution.perform(validationSet); // don't await this call since the validation is performed asynchronously

    return res.status(202).location(`/executions/${execution.id}`).end();
  } catch(e) {
    return next(new Error(e.message));
  }
});

/**
 * Get the status of an execution
 * Status is one of "ongoing", "done", "failed", "canceled".
 *
 * @return [200] with the execution status object
 * @return [404] if an execution with given id cannot be found
*/
app.get('/executions/:id', async function(req, res, next) {
  try {
    const executionId = req.params.id;
    const execution = await executionByUuid(executionId);

    if (execution) {
      return res.send(execution.toJsonApi());
    } else {
      return res.status(404).end();
    }
  } catch(e) {
    return next(new Error(e.message));
  }
});

app.use(errorHandler);
