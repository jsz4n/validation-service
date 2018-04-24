# validation-service
Microservice to execute async data validations using configurable in code validations. The validation execution's progress and validation errors are written to the store. This microservice only provides endpoints (1) to trigger an async execution of a validation set and (2) to monitor the status of a single execution. Endpoints to get all executions, validations and errors should be configured using [mu-cl-resources](https://github.com/mu-semtech/mu-cl-resources).

## Installation
To add the service to your stack, add the following snippet to `docker-compose.yml`:
```yaml
services:
  validation:
    image: semtech/mu-validation-service:0.2.0
    volumes:
      - ./config/validations:/config
```

Don't forget to update the dispatcher configuration to route requests to the validation service.

## Configuration
Validations are provided in code as an array of javascript objects exported in `/config/index.js`.

Each validation object should have the following properties:
* name [string]: name of the validation rule
* description [string]: description of the validation rule
* validationSets [array[uri]]: list of URIs defining the sets to which the validation rule belongs
* validate [(execution) => [object]]: function that executes the validation and returns an array of validation errors. An empty array means the validation succeeded. The function receives the current execution as parameter. Validation errors must be written to the store in this function. The helpers functions described below may be of help to implement this function.

Note: the application graph is available through `process.env.MU_APPLICATION_GRAPH`.

## Helper functions
The validation service provides helpers functions to implement the validate function of a validation rule. Currently the helpers functions listed below are available. They can be imported from `/app/helpers`.

E.g. `import { validateSparqlSelect } from '/app/helpers';`

### Validations using a SPARQL query
#### validateSparqlSelect(sparqlQuery)
Helper function to make a validation rule using a SPARQL SELECT query. The validation is considered invalid if the query returns any result. Each entry in the result set is stored as a validation error in the store.

The error message per entry is constructed by calling the validation's message function passing the result bindings of the SELECT query as a params object. E.g. `{ "s": "http://data.lblod.info/id/mandataris/123", "start": "01-12-2018" }`. These values can then be used to construct the error message.

Example validation:
```javascript
  {
    name: 'my-validation',
    description: 'Start date must fall before end date',
    validationSets: [
      'http://data.lblod.info/id/validation-set/mandatendatabank'
    ],
    message: function(params) {
      return `Mandataris ${params['s']}: start date ${params['start']} is later than end date ${params['einde']}`;
    },
    validate: validateSparqlSelect(`
        PREFIX mandaat: <http://data.vlaanderen.be/ns/mandaat#>
        PREFIX mu: <http://mu.semte.ch/vocabularies/core/#>
        SELECT ?s ?uuid ?start ?einde
        FROM <${process.env.MU_APPLICATION_GRAPH}>
        WHERE {
          ?s a mandaat:Mandataris ;
             mandaat:start ?start ;
             mandaat:einde ?einde .
          OPTIONAL { ?s mu:uuid ?uuid } 
          FILTER (?einde < ?start)
        }`)
  }
```

#### validateSparqlAsk(sparqlQuery)
Helper function to make a validation rule using a SPARQL ASK query. The validation is considered invalid if the query returns 'false'. In that case one validation error is written to the store. The error message of the validation may be a static string or a parameterless function.

Example validation:
```javascript
  {
    name: 'my-validation',
    description: 'At least 1 person',
    validationSets: [
      'http://data.lblod.info/id/validation-set/mandatendatabank'
    ],
    message: 'At least 1 persoon',
    validate: validateSparqlAsk(`
        PREFIX persoon: <http://data.vlaanderen.be/ns/persoon#>
        ASK {
          GRAPH <${process.env.MU_APPLICATION_GRAPH}> {
            ?s a persoon:Persoon .
          }
        }`)
  }
```


### Validation errors
#### insertNewError(executionUri, validationUri, message)
Helper function to write a validation error to the store.

Parameters:
* executionUri [string]: URI of the execution that produced the validation error
* validationUri [string]: URI of the validation that failed
* message [string]: error message of the validation

The function returns a `ValidationError` object with a `uri` property such that the user can enrich the data stored about the validation error afterwards.

#### insertNewErrors(errors)
Helper function to write multiple validation errors in bulk to the store.

Parameters:
* errors [array]: Array of validation error objects. Each error object must contain the following properties:
** executionUri [string]: URI of the execution that produced the validation error
** validationUri [string]: URI of the validation that failed
** message [string]: error message of the validation

The function returns an array of `ValidationError` objects with a `uri` property such that the user can enrich the data stored about the validation errors afterwards.

## API
### POST /executions
Trigger an async execution of a validation set.

Request body may optionally define a validation set. If no validation set is speficied all validations will be executed.
E.g.
```javascript
{
  "validation-set": "http://data.lblod.info/id/validation-set/mandatendatabank"
}
```

### GET /executions/:id
Monitor the status of a single execution. Status is one of `ongoing`, `done`, `failed`, `canceled`.

Example
```javascript
{
    "data": {
        "type": "executions",
        "id": "d1a1d430-43dc-11e8-a5fd-9b3cd5f0fe08",
        "attributes": {
            "uri": "http://mu.semte.ch/services/validation-service/executions/d1a1d430-43dc-11e8-a5fd-9b3cd5f0fe08",
            "status": "failed",
            "created": "2018-04-19T14:20:32.371Z"
        }
    }
}
```

## Retrieving executions, validations and errors using mu-cl-resources
This microservice only provides endpoints (1) to trigger an async execution of a validation set and (2) to monitor the status of a single execution. Endpoints to get all executions, validations and errors should be configured using [mu-cl-resources](https://github.com/mu-semtech/mu-cl-resources).

Add the following configuration to your `domain.lisp`
```lisp
(define-resource validation-execution ()
  :class (s-prefix "validation:Execution")
  :properties `((:status :string ,(s-prefix "validation:status"))
                (:created :datetime ,(s-prefix "dct:created")))
  :has-many `((validation-error :via ,(s-prefix "validation:generatedBy")
                                :inverse t
                                :as "errors")
              (validation :via ,(s-prefix "validation:performsValidation")
                       :as "validations"))
  :resource-base (s-url "http://mu.semte.ch/services/validation-service/executions/")
  :features '(include-uri)
  :on-path "validation-executions"
)

(define-resource validation ()
  :class (s-prefix "validation:Validation")
  :properties `((:name :string ,(s-prefix "validation:name"))
                (:description :string ,(s-prefix "validation:description"))                
                (:status :string ,(s-prefix "validation:status")))
  :has-one `((validation-execution :via ,(s-prefix "validation:performsValidation")
                                   :inverse t
                                   :as "execution"))
  :has-many `((validation-error :via ,(s-prefix "validation:validation")
                                   :inverse t
                                   :as "errors"))
  :resource-base (s-url "http://mu.semte.ch/services/validation-service/validations/")
  :features '(include-uri)
  :on-path "validations"
)


(define-resource validation-error ()
  :class (s-prefix "validation:Error")
  :properties `((:message :string ,(s-prefix "validation:message")))
  :has-one `((validation-execution :via ,(s-prefix "validation:producedBy")
                                   :as "execution")
             (validation :via ,(s-prefix "validation:validation")
                                   :as "validation"))             
  :resource-base (s-url "http://mu.semte.ch/services/validation-service/validation-errors/")
  :features '(include-uri)
  :on-path "validation-errors"
)
```

Add the following dispatcher rules in `dispatcher.ex`
```erlang
  get "/validation-executions/*path" do
    Proxy.forward conn, path, "http://resource/validation-executions/"
  end
  get "/validations/*path" do
    Proxy.forward conn, path, "http://resource/validations/"
  end
  get "/validation-errors/*path" do
    Proxy.forward conn, path, "http://resource/validation-errors/"
  end
```

The errors of the latest validation execution of a specific set can be retrieved via
```
GET /validation-executions?sort=-created&filter[status]=done&filter[validation-set]=http://data.lblod.info/id/validation-set/mandatendatabank&page[size]=1&include=errors
```

## Development
Add the following snippet to your stack during development:
```yaml
services:
  validation:
    image: semtech/mu-javascript-template:1.2.0
    ports:
      - 8888:80
    environment:
      NODE_ENV: "development"
    volumes:
      - /path/to/your/code:/app/
      - ./config/validations:/config
```
