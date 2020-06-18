# Standard Production Architecture


![Production Architecture](./architecture/production_architecture.svg)

1. Connexion to database, see `sqlalchemy.url` parameter.
2. Connexion to file storage: see :
    - `depot_storage_dir` : File storage dir
    - `preview_cache_dir`: Cache of preview dir
    - `session.data_dir`: Content of session if session type is file.
    - `session.lock_dir`: Lock for session
    - `caldav.radicale.storage.filesystem_folder`: Required agenda app enabled, Dir where caldav server file are stored
    - `collaborative_document_edition.file_template_dir`: Required collaborative document edition app enabled, Dir where template for collaborative edition document are stored.

3. Connexion to ldap, Used only if Ldap is in auth_types: see parameters `ldap_*` and `auth_types `parameter.
4. Connexion to redis: You can use redis for jobs if `jobs.processing_mode` is "async". You can also use redis for session with `session.type = ext:redis`
5. Connexion to Mail server, you can set both smtp and imap server, smtp serve for email notification and imap server for reply by email feature (require `mail fetcher` daemon runned),
see `email.*` parameters
6. Connexion to CollaboraOnline/Libreoffice Online, require collaborative_document_edition app enabled, see `collaborative_document_edition.*` parameters
7. Pushpin Connexion. See `live_messages.control_uri` for url used by tracim to push live messages. Note: don't forget to proxy correctly the pushpin endpoints to pushpin server.
8. Tracim Web to Tracim Caldav internal proxying. see `caldav.radicale_proxy.base_url` (path to caldav for tracim web) and `caldav.radicale.server.host` (self host known by caldav server)
9. Connexion to elasticsearch engine. need `search.engine` be set to `elasticsearch`, see `search.elasticsearch.*` parameters
