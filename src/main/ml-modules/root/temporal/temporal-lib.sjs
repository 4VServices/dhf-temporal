"use strict";

function removeArchive(uri) {
  xdmp.log(`Performing an amped delete of ${uri}`);
  xdmp.securityAssert(
    "http://marklogic.com/xdmp/privileges/temporal-admin",
    "execute"
  );
  xdmp.documentDelete(uri);
}

exports.removeArchive = module.amp(removeArchive);
