# coding: utf8

import os

from yaml import load as yaml_load
from yaml import YAMLError

from tracim_sync_exceptions import ConfigException

BASE_FOLDER_KEY = 'base_folder'
DB_PATH_key = 'db_path'
INSTANCES_key = 'instances'


class Config(object):

    def __init__(self, config_as_dict: dict):
        self.BASE_FOLDER = config_as_dict.get('base_folder')
        self.DB_PATH = config_as_dict.get('db_path')
        self.INSTANCES = config_as_dict.get('instances')

    def get_instance(self, instance_label: str):
        return self.INSTANCES[instance_label]


class ConfigParser(object):

    def load_config_from_file(self, file_path=''):
        if not file_path:
            file_path = "config.yaml"
        if not os.path.isfile(file_path):
            raise ConfigException(
                'Aucun fichier de configuration correspondans à {}'.format(
                    file_path
                )
            )
        with open(file_path, 'r') as config_file:
            try:
                config = Config(yaml_load(config_file))
            except YAMLError:
                import ipdb; ipdb.set_trace()
                raise ConfigException(
                    'Erreur de syntax dans le fichier de configuration'
                )
        self._check(config)
        return config

    def _check(self, config: Config):
        if not config.BASE_FOLDER:
            raise ConfigException(
                'Le dossier de syncronisation local n\'est pas configuré'
            )

        if not config.DB_PATH:
            raise ConfigException(
                'Le chemin vers la base de données n\'est pas configuré'
            )

        if not config.INSTANCES:
            raise ConfigException(
                'Il faut définir au moins une instance '
                'de tracim à synchroniser'
            )

        for instance_name, params in config.INSTANCES.items():
            if not params.get('url'):
                raise ConfigException(
                    'Une url doit etre défini pour l\'instance {}'
                    .format(instance_name)
                )

            token = not(params.get('token'))
            basic_auth = not (params.get('login') and params.get('password'))

            if not (token or basic_auth):
                raise ConfigException(
                    'Un token de connexion ou un login/password doit etre '
                    'défini pour l\'instance {}'.format(instance_name)
                )

            if not (params.get('webdav') and params.get('webdav').get('url')):
                raise ConfigException(
                    'Une url pour le serveur webdav doit etre'
                    'défini pour l\'instance {}'.format(instance_name)
                )
