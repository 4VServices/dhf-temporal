# Example of Temporal with Data Hub Framework

## Goal

Demonstrate that MarkLogic's Data Hub Framework works in conjunction with uni-temporal documents. Show how to find the
different versions of a file.

## Deploying & Running

Modify the path of the `-PoptionsFile` to match your path.

```
./gradlew mlDeploy -i
./gradlew mlLoadData
./gradlew hubRunFlow -PflowName=Claims -PoptionsFile="C:\users\DavidCassel\git\4V\dhf-temporal\optionsBatch1.json"
./gradlew hubRunFlow -PflowName=Claims -PoptionsFile="C:\users\DavidCassel\git\4V\dhf-temporal\optionsBatch2.json"
```

## What to look at

We're loading data in two batches, similulating data coming through at different times. The first batch has "claim1"
and "claim2". The second batch updates those two and adds a "claim3". The goal here is to allow the updates to
overwrite the old data, while keeping a record of what was previously known.

After the running the two batches, look at the "/claims/" directory in the data-hub-FINAL database. You'll see URIs
like the following:

| URI                                     | Collections                                 |
| --------------------------------------- | ------------------------------------------- |
| /claims/claim1.2948008507251790323.json | claim/temporal, /claims/claim1.json         |
| /claims/claim1.json                     | claim/temporal, /claims/claim1.json, latest |
| /claims/claim2.2948008507251790323.json | claim/temporal, /claims/claim2.json         |
| /claims/claim2.json                     | claim/temporal, /claims/claim2.json, latest |
| /claims/claim3.json                     | claim/temporal, /claims/claim3.json, latest |

Taking a look at claim1, we see the URIs "/claims/claim1.json" and "/claims/claim1.2948008507251790323.json". The
second is the original document, which was moved to make way for the new data. Note that "/claims/claim1.json" has the
"latest" collection.

## Interesting queries

When you use temporal, you'll generally want to use the "latest" collection as part of your query. This will restrict
your query to only active documents.

On the other hand, if you want to understand the history of a document, you can use the collection that matches up with
the URI you are interested in.

```
cts.uris(null, null, cts.collectionQuery("/claims/claim1.json"))
  .toArray()
  .map(uri => {
    return {
      uri,
      systemStart: xdmp.documentGetMetadataValue(uri, "claim-system-start"),
      systemEnd: xdmp.documentGetMetadataValue(uri, "claim-system-end")
    }
  })
```

This query returns:

```
[
  {
    "uri": "/claims/claim1.2948008507251790323.json",
    "systemStart": "2022-10-12T20:00:17.159443Z",
    "systemEnd": "2022-10-12T20:00:57.750561Z"
  },
  {
    "uri": "/claims/claim1.json",
    "systemStart": "2022-10-12T20:00:57.750561Z",
    "systemEnd": "9999-12-31T11:59:59Z"
  }
]
```

# What makes it tick

There are a couple components needed to use MarkLogic's temporal feature. See the following:

- src/main/ml-config/databases/data-hub-FINAL/temporal/axes/temporal-system-axis.json
  - This axis defines the method used to track the temporal timestamps. In this case, we're using document metadata.
- src/main/ml-config/databases/data-hub-FINAL/temporal/collections/temporal.json
  - This is the temporal collection.
- src/main/ml-config/databases/final-database.json
  - The database configuration includes a field definition for the metadata.
- steps/mapping/Claims_Map.step.json
  - The target collection for the step is the temporal collection.

# Managing the Archives

Part of the goal of the temporal feature is to ensure that the archived documents are preserved. That means that
deleting a document under temporal protection is explicitly prohibited -- it will trigger an error. But what if you
really want to? You may want the archive to be created, but have the ability to clean up the archives at a later time.

When we create the temporal collection, we can specify one of two options. The default is `"updates-safe"`, which
prohibits any non-temporal change to a temporal document. There is also the `"updates-admin-override"` option, which
allows a user with the admin role to make updates to a document.

Since we generally don't want to be using the admin role in the normal operation of an application, this project
encapsulates the deletion within a function, which is then given an amp. Normal (non-admin) users will not be able to
delete a temporal document, but any user can call this amped function. The function itself asserts that the current
user has the `temporal-admin` privilege. A user without that privilege who calls that function will still get an error.
A user with that role will be able to delete a temporal document.

See:

- src/main/ml-config/security/amps/removeArchive.json
- src/main/ml-modules/root/temporal/temporal-lib.sjs

After deploying these changes and creating a `hub-developer` user that has the `temporal-admin` role, the following
will work (update the URI to match one in your database):

```
'use strict';

const temp = require("/temporal/temporal-lib.sjs")

xdmp.invokeFunction(
  () => temp.removeArchive("/claims/claim2.17589689172117168010.json"),
  {
    "update": "true",
    "userId": xdmp.user("hub-developer")
  }
)
```

# De-temporalizing

You get all this set up, your ingest is running, and your data set is growing. You may decide at some point that the
archived documents created by temporal aren't worth the space. Are you stuck with temporal? No! Here's what you need to
do to make your documents not use the temporal feature anymore:

1. Remove all documents from the temporal collection. This will likey be a CORB job.
2. Remove the temporal collection. This requires the `admin` role. This won't happen in the normal course of an
   application, so I didn't set up an `amp` for this, but you could do so if your use case needs it.

At this point, any user with update permissions on the document will be able to make non-temporal updates (including
deletes) of the previously temporal documents.

```
'use strict';

declareUpdate();

const temporal = require("/MarkLogic/temporal.xqy");

temporal.collectionRemove("claim/temporal")
```
