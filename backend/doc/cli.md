# Controlling Tracim from the Command Line Using `tracimcli` #

Tracim has a build-in command line tool.

## Introduction ##

This document is intended to developers or sysadmin.

In order to use the `tracimcli` commands, go to the root of the project and
and active the Tracim virtualenv:

    user@host:~/tracim_backend$ source env/bin/activate
    (env) user@host:~/tracim_backend$

## Database ##

### Create the database

    tracimcli db init

### Create the database with some default test data (many users, workspaces, etc…)

    tracimcli db init --test-data

### Delete the database /!\

This will drop the entire database, be careful!

    tracimcli db delete --force

### Update naming conventions for database coming from Tracim V1 (only works with PostgreSQL)

Useful to migrate old databases, to run before applying v3.0.0 migration scripts with alembic:

    tracimcli db update-naming-conventions

### Migrate Mysql/Mariadb database to utf8mb4 (added for tracim 3.7)

:warning: This will modify the character set and collation of Tracim's database, including the already existing tables. We strongly suggest you to do a backup of the database before applying this command. We suggest you to follow official documentation of your database to do so.

Useful to migrate old databases on MySQL or MariaDB in order to have full Unicode support. This is mandatory on Tracim version 3.7 and later to support emoji reactions.

This fix is needed for proper working emoji character in tracim, don't applying this fix (if you database has not already the correct charset/collation) will lead to an almost working tracim, but adding emoji or complex unicode character in tracim will fail, this will make impossible to add any reaction.

For mysql 8.0.1+ (force collation to `utf8mb4_0900_ai_ci` as this is better than `utf8mb4_unicode_520_ci`):
```bash
tracimcli db migrate-mysql-charset -d --collation utf8mb4_0900_ai_ci
```

For mariadb 10.3+ (use collation `utf8mb4_unicode_520_ci` by default):
```bash
tracimcli db migrate-mysql-charset -d
```

## User ##

### add a user

```
$ tracimcli user create -h
usage: tracimcli user create [-h] [-c CONFIG_FILE] [-d] [-e EMAIL]
                             [-u USERNAME] [--public-name PUBLIC_NAME]
                             [--allowed_space ALLOWED_SPACE] [--lang LANG]
                             [-p PASSWORD] [--profile PROFILE]
                             [--timezone TIMEZONE] [--send-email]

Create a new user account

optional arguments:
  -h, --help            show this help message and exit
  -c CONFIG_FILE, --config CONFIG_FILE
                        configuration file to use (default: development.ini)
  -d, --debug_mode      enable Tracim log for debug
  -e EMAIL, --email EMAIL
                        set the user's email address
  -u USERNAME, --username USERNAME
                        set the user's username
  --public-name PUBLIC_NAME
                        set the user's public name
  --allowed_space ALLOWED_SPACE
                        set thes user's allowed space in bytes
  --lang LANG           set the user's language (ISO 639 format)
  -p PASSWORD, --password PASSWORD
                        set the user's password
  --profile PROFILE     set the user's profile. Valid values: users, trusted-
                        users, administrators
  --timezone TIMEZONE   set the user's timezone
  --send-email          send an email to the created user (you need to
                        configure EMAIL-NOTIFICATION part in config file to
                        use this feature)
```

Example of creating a user with an email, a password and sending account information by email:

```
  tracimcli user create -e "john.does@example.tld" -p "superpassword" --send-email
```

If you don't provide password and use --send-email, an autogenerated password will be created and sent to the user by email, example:


```
  tracimcli user create -e "john.does@example.tld" --send-email --lang "fr"
```

:warning: if you don't provide any password and don't use `--send-email`, no password will be created. You can use `tracimcli user update` to set the password later.

Another example with a username-only user (this requires `email.required=false`) and more parameters:

```
  tracimcli user create -u "john" -p "superpassword" --profile "trusted-users" --lang "fr" --public-name "John Doe"
```

### update user password

```
$ tracimcli user update -h
usage: tracimcli user update [-h] [-c CONFIG_FILE] [-d] [-e EMAIL]
                             [-u USERNAME] [--public-name PUBLIC_NAME]
                             [--allowed_space ALLOWED_SPACE] [--lang LANG]
                             [-p PASSWORD] [--profile PROFILE]
                             [--timezone TIMEZONE] -l LOGIN

Edit the account of a user

optional arguments:
  -h, --help            show this help message and exit
  -c CONFIG_FILE, --config CONFIG_FILE
                        configuration file to use (default: development.ini)
  -d, --debug_mode      enable Tracim log for debug
  -e EMAIL, --email EMAIL
                        set the user's email address
  -u USERNAME, --username USERNAME
                        set the user's username
  --public-name PUBLIC_NAME
                        set the user's public name
  --allowed_space ALLOWED_SPACE
                        set thes user's allowed space in bytes
  --lang LANG           set the user's language (ISO 639 format)
  -p PASSWORD, --password PASSWORD
                        set the user's password
  --profile PROFILE     set the user's profile. Valid values: users, trusted-
                        users, administrators
  --timezone TIMEZONE   set the user's timezone
  -l LOGIN, --login LOGIN
                        the user's login (either the email address or the
                        username)
```

Example:

    tracimcli user update -l "john.does@example.tld" -p "mynewsuperpassword"

Note: login (-l) is the current login of the user whereas username(-u), email (-e), password (-p), etc… are the
new values to set.

Another example with more parameters
```
  tracimcli user update -l "john.does@example.tld" -u "john" --profile "trusted-users" --lang "fr" --public-name "John Doe"
```

### Delete user(s)

Theses commands allow deleting users from the database. Unlike deletion from the Tracim
UI which only hides data, this command does delete the content from database, so be careful using this.

`user delete` provides many parameters in order to choose how you want to delete an user.
We suggest to anonymize them (see `-a` or `-b` ) in case deleting them might cause trouble.

```
$ tracimcli user delete -h
usage: tracimcli user delete [-h] [-c CONFIG_FILE] [-d] [--dry-run] [-b] [-f]
                             [-a] [--anonymize-name ANONYMIZE_NAME] [-r] [-w]
                             -l LOGINS [LOGINS ...]

Remove user account(s) and related information from the database

optional arguments:
  -h, --help            show this help message and exit
  -c CONFIG_FILE, --config CONFIG_FILE
                        configuration file to use (default: development.ini)
  -d, --debug_mode      enable Tracim log for debug
  --dry-run             dry-run mode, simulate action to be done but do not
                        modify anything
  -b, --best-effort     trying doing the best deletion possible, same as '-w
                        -a'
  -f, --force           force user deletion, same as '-r -w'. Warning ! This
                        may create inconsistent database
  -a, --anonymize-if-required
                        anonymize the user account when it cannot be deleted
  --anonymize-name ANONYMIZE_NAME
                        anonymized user display name to use if anonymize
                        option is activated
  -r, --delete-all-user-revisions
                        delete all user revisions. Warning ! This may put the
                        database into an inconsistent state
  -w, --delete-owned-sharespaces
                        also delete owned sharespaces of user
  -l LOGINS [LOGINS ...], --login LOGINS [LOGINS ...]
                        user logins (email or username) to delete one or more
                        users
```

### Anonymize User(s)

You can also anonymize user without deleting any user data user using
command `tracimcli anonymize`.

```
$ tracimcli user anonymize -h
usage: tracimcli user anonymize [-h] [-c CONFIG_FILE] [-d] [--dry-run]
                                [--anonymize-name ANONYMIZE_NAME] -l LOGINS
                                [LOGINS ...]

anonymize user account(s) from database

optional arguments:
  -h, --help            show this help message and exit
  -c CONFIG_FILE, --config CONFIG_FILE
                        configuration file to use (default: development.ini)
  -d, --debug_mode      enable Tracim log for debug
  --dry-run             dry-run mode
  --anonymize-name ANONYMIZE_NAME
                        anonymized user display name to use if anonymize
                        option is activated
  -l LOGINS [LOGINS ...], --login LOGINS [LOGINS ...]
                        user logins (email or username)
```

## Caldav ##

### Run the Service ###

    tracimcli caldav start

### Check and Recreate the Agenda for a User/Workspace ###

In some cases, creating the agenda of an user or a workspace can fail.
To check if all agendas are created and to force their creation if they are not,
you can run:

    tracimcli caldav sync

## WebDAV ##

### Run the Service ###

    tracimcli webdav start

## Help ##

    tracimcli -h

## Dev/Support Tools ##

:warning: These tools are only for dev or support and are experimental, syntax and behaviour may change in future tracim version.

## Parameters list

To know fresh tracim parameters list used,
you can do:

    tracimcli dev parameters list

This will give you an almost complete list of tracim parameters available.
The list is the same as the list available in [settings documentation](setting.md).

Others parameters are available using internal documentation:

    tracimcli dev parameters list -h

## Parameters values and more

To get all parameters values applied:

    tracimcli dev parameters value

Many others parameters are available using internal documentation:

    tracimcli dev parameters value -h

Example 1: getting a specific parameter value applied:

    # with config file name syntax:
    tracimcli dev parameters value -n app.enabled
    # is equivalent to (tracim internal parameter syntax):
    tracimcli dev parameters value -n APP__ENABLED
    # is equivalent to (env var syntax):
    tracimcli dev parameters value -n TRACIM_APP__ENABLED

Example 2: getting default value of parameters:

    tracimcli dev parameters value --template "|{config_name: <30}|{default_value: <30}"

Example 3: getting the maximum information known about a specific parameter:

    tracimcli dev parameters value -f -n DEBUG
