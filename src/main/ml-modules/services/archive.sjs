function deleteFunction(context, params) {
  const temp = require("/temporal/temporal-lib.sjs");
  if (!params.uri) {
    fn.error(
      null,
      "RESTAPI-SRVEXERR",
      Sequence.from([400, "Bad Request", `rs:uri is a required parameter`])
    );
  } else if (fn.docAvailable(params.uri)) {
    try {
      temp.removeArchive(params.uri);
    } catch (ex) {
      if (ex.name === "SEC-PRIV") {
        fn.error(
          null,
          "RESTAPI-SRVEXERR",
          Sequence.from([
            403,
            "Forbidden",
            "Calling this endpoint requires the http://marklogic.com/xdmp/privileges/temporal-admin privilege",
          ])
        );
      }
    }
  } else {
    fn.error(
      null,
      "RESTAPI-SRVEXERR",
      Sequence.from([
        404,
        "Not Found",
        `No document is available at ${params.uri}`,
      ])
    );
  }
}

exports.DELETE = deleteFunction;
