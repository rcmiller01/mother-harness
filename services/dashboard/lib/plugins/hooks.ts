/**
 * Plugin Hooks
 * React hooks for plugin system integration
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { pluginRegistry } from './registry';
import type {
    PluginInstance,
    PanelRegistration,
    CommandRegistration,
} from './types';

/** Hook to access all registered plugins */
export function usePlugins(): PluginInstance[] {
    const [plugins, setPlugins] = useState<PluginInstance[]>([]);

    useEffect(() => {
        // Initial load
        setPlugins(pluginRegistry.getPlugins());

        // Subscribe to changes
        return pluginRegistry.onPluginsChange(setPlugins);
    }, []);

    return plugins;
}

/** Hook to access plugin-registered panels */
export function usePluginPanels(): PanelRegistration[] {
    const [panels, setPanels] = useState<PanelRegistration[]>([]);

    useEffect(() => {
        // Initial load
        setPanels(pluginRegistry.getPanels());

        // Subscribe to changes
        return pluginRegistry.onPanelsChange(setPanels);
    }, []);

    return panels;
}

/** Hook to access plugin-registered commands */
export function usePluginCommands(): CommandRegistration[] {
    const [commands, setCommands] = useState<CommandRegistration[]>([]);

    useEffect(() => {
        // Initial load
        setCommands(pluginRegistry.getCommands());

        // Subscribe to changes
        return pluginRegistry.onCommandsChange(setCommands);
    }, []);

    return commands;
}

/** Hook to manage a specific plugin */
export function usePlugin(pluginId: string) {
    const [plugin, setPlugin] = useState<PluginInstance | undefined>();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setPlugin(pluginRegistry.getPlugin(pluginId));

        return pluginRegistry.onPluginsChange(() => {
            setPlugin(pluginRegistry.getPlugin(pluginId));
        });
    }, [pluginId]);

    const activate = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            await pluginRegistry.activate(pluginId);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to activate');
        } finally {
            setLoading(false);
        }
    }, [pluginId]);

    const deactivate = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            await pluginRegistry.deactivate(pluginId);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to deactivate');
        } finally {
            setLoading(false);
        }
    }, [pluginId]);

    const uninstall = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            await pluginRegistry.unregister(pluginId);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to uninstall');
        } finally {
            setLoading(false);
        }
    }, [pluginId]);

    return {
        plugin,
        loading,
        error,
        activate,
        deactivate,
        uninstall,
    };
}
