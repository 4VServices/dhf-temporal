# Example of Temporal with Data Hub Framework

## Goal

Demonstrate that MarkLogic's Data Hub Framework works in conjunction with uni-temporal documents. Show how to find the
different versions of a file.

## Deploying & Running

Modify the path of the `-PoptionsFile` to match your path.

```
./gradlew mlDeploy -i
./gradlew mlLoadData
./gradlew mlRunFlow -PflowName=Claims -PoptionsFile="C:\users\DavidCassel\git\4V\dhf-temporal\optionsBatch1.json"
./gradlew mlRunFlow -PflowName=Claims -PoptionsFile="C:\users\DavidCassel\git\4V\dhf-temporal\optionsBatch2.json"
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
