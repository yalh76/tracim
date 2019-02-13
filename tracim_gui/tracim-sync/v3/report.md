# POC syncronization

## Usecases

The primary goal of this first version is to syncronize a tracim instance on a local computer.


Unlike Webdav, files had to be available even when networks isn't available.
Unlike Tracim only the last version of a document have to be kept.

It had to be easily setup with a configuration file written in `yaml`

## Actual solution

### Setup

```
base_folder: "/tmp/tracim-sync"
db_path: "/tmp/test.sqlite"
instances:
  tracim:
    url: "http://localhost:6543"
    login: "admin@admin.admin"
    password: "admin@admin.admin"
    webdav:
      url: "http://localhost:3030"
    excluded_workspaces: []
    excluded_folders: []
```

The configuration contains 3 mains parameters:

`base_folder` is the folder where the files will be downloaded
`db_path` is where the sqlite file will be created
`instances` is a dictionnary with informations corresponding to:
  - the main key (in our example "tracim") is a label you gives to this instance and will be the name of the folder containing the documents
  - the required informations to connect to the instance
  - optionnal `id` for workspaces and folders you don't want to syncronize


### Workflow

The synchronization is divided in 3 main steps.

First step is fetching informations from tracim:
  1. Asking ids of workspaces
  2. For each workspaces collecting the last version of every content

If it's not the first syncronization then we will only fetch contents with higher `revision_id` than the highest stored in our local db.

Then all theses json results are transformed in an Python object version so we don't need to work with `string` keys.
ex content['parent_id'] becomes content.parent_id

Tracim gives a `content_id` to every content, in our local database, because we can have multiple content with the same `content_id` due to multiple tracim instances, we gives them another `id` and we rename `content_id` to `remote_id`
Second step is to add all theses objects in the database, based on the `remote_id`, if we don't have the couple  `tracim_instance`/`remote_id` it's a new content and we have to create it, else we have to update it.

The update action is established by comparing data from the database and the API result:
  1. Only revision_id is changed -> the content of the document has changed
  2. Filename, parent_id or workspace_id is changed -> the local path of the file has changed
  3. is_deleted or is_archived -> the document needs to be deleted

Threads have a subtle difference, their revision_id change only if they are renamed.
The way to detect if they have been updated is to parse contents of type `comment` and match their threads using their `parent_id`.
ex: if we fetch the content `id` 3 with a `parent_id` 2 during our synchronization we need to update content `id` 2 but not content `id` 3.

As we don't save comment in our database but we need the last `revision_id` we fetched, we link the comment's `revision_id` to its thread.

At the end of the second step we have updated our database with for each contents a `Flag`:
  * NEW : new content
  * CHANGED : content of the document has changed
  * MOVED : local path has changed
  * DELETED : deleted content
  * SYNCED : nothing has changed, local content is synced with tracim

Third step is creating and syncing local contents in a specific order:
  1. Creating all folders
  2. Moving folders
  *at this point we have all the containers for our documents*
  3. Moving documents
  4. Deleting folders and documents
  5. Updating documents
  *We move documents before deleting so we don't delete a document with its old folder, but we update after so we don't download a document just before deleting it*
  6. Creating new documents


### Issues with this solution

#### Impossible operation

The current solution works well for basic cases but in some twisted case it leads to severe bugs, for example:

Using the application we rename File1 -> TempFile, File2 -> File1 and finally TempFile -> File2. Calling the API afterward these operations will only retrieve 2 actions File1 -> File2 and File2 -> File1 which is an impossible operation.


#### Desyncing / Resyncing excluded contents

Once a content or workspace is excluded it is not possible to sync it unless it is updated afterward.

If we synced a workspace or a folder then exclude it with the config file it'll just stop syncing but it won't be deleted.
This behavior could be considered a feature but it's a bug.

#### Complexity

Even after breaking up the workflow in 3 steps it is still difficult to dive in.
The rigidity of the workflow makes it sensitive to modification without side effects and the order cannot be changed.


## Future solution

The current solution is working fine for a first syncronization, we could refactor it and simplify it but the workflow is good.

For later syncronizations a safer workflow would be:
  * Fetching every `content_revision`
  * Perform the corresponding action for every revision

The simplicity of this solution makes it easy to understand and at the same time fix the issue of impossible operation.

This soluttion could also allows downgrade operations by replaying all the operations in reverse.

The main issue with it though, is that is will cost a lot of resource and, without optimisation, if a content is updated 10 times in a row we will download its updates 10 times.