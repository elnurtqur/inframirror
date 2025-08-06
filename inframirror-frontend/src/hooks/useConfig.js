import { useState, useEffect, useCallback } from 'react';

const CONFIG_STORAGE_KEY = 'vmware_collector_config';

const DEFAULT_CONFIG = {
  jira: {
    api_url: 'https://jira-support.company.com/rest/insight/1.0/object/navlist/iql',
    token: '',
    create_url: 'https://jira-support.company.com/rest/insight/1.0/object/create',
    object_type_id: '3191',
    object_schema_id: '242'
  },
  vcenter: {
    host: 'kb-bnk-bmdc-vc1.company.com',
    username: '',
    password: '',
    port: 443
  }
};

export const useConfig = () => {
  const [config, setConfigState] = useState(DEFAULT_CONFIG);
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

  // Load config from localStorage on mount
  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (savedConfig) {
        const parsedConfig = JSON.parse(savedConfig);
        setConfigState(parsedConfig);
      }
    } catch (error) {
      console.error('Failed to load config from localStorage:', error);
    } finally {
      setIsConfigLoaded(true);
    }
  }, []);

  // Save config to localStorage whenever it changes
  const setConfig = useCallback((newConfig) => {
    try {
      const configToSave = typeof newConfig === 'function' 
        ? newConfig(config) 
        : newConfig;
      
      setConfigState(configToSave);
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(configToSave));
    } catch (error) {
      console.error('Failed to save config to localStorage:', error);
    }
  }, [config]);

  // Reset config to defaults
  const resetConfig = useCallback(() => {
    setConfigState(DEFAULT_CONFIG);
    localStorage.removeItem(CONFIG_STORAGE_KEY);
  }, []);

  // Check if config is complete
  const isConfigComplete = useCallback(() => {
    const { jira, vcenter } = config;
    return (
      jira.token && jira.token.trim() !== '' &&
      vcenter.username && vcenter.username.trim() !== '' &&
      vcenter.password && vcenter.password.trim() !== ''
    );
  }, [config]);

  // Get config for API calls
  const getApiConfig = useCallback(() => {
    return {
      jira_config: {
        api_url: config.jira.api_url,
        token: config.jira.token,
        create_url: config.jira.create_url,
        object_type_id: config.jira.object_type_id,
        object_schema_id: config.jira.object_schema_id
      },
      vcenter_config: {
        host: config.vcenter.host,
        username: config.vcenter.username,
        password: config.vcenter.password,
        port: config.vcenter.port
      }
    };
  }, [config]);

  return {
    config,
    setConfig,
    resetConfig,
    isConfigComplete,
    isConfigLoaded,
    getApiConfig
  };
};