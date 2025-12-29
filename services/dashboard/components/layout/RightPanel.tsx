/**
 * Right Panel Component
 * Tabbed panel for agents, context, tasks, files, and approvals
 */

'use client';

import React from 'react';
import {
    Users,
    FileText,
    CheckSquare,
    FolderOpen,
    ShieldCheck,
    PanelRightClose,
} from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useResizable } from '../../hooks/useResizable';
import { AgentsPanel } from '../panels/AgentsPanel';
import { ContextPanel } from '../panels/ContextPanel';
import { TasksPanel } from '../panels/TasksPanel';
import { FilesPanel } from '../panels/FilesPanel';
import { ApprovalsPanel } from '../panels/ApprovalsPanel';
import type { RightPanelTab } from '../../types/ui';
import styles from './RightPanel.module.css';

interface RightPanelProps {
    width: number;
}

const tabs: Array<{ id: RightPanelTab; label: string; icon: React.ReactNode }> = [
    { id: 'agents', label: 'Agents', icon: <Users size={16} /> },
    { id: 'context', label: 'Context', icon: <FileText size={16} /> },
    { id: 'tasks', label: 'Tasks', icon: <CheckSquare size={16} /> },
    { id: 'files', label: 'Files', icon: <FolderOpen size={16} /> },
    { id: 'approvals', label: 'Approvals', icon: <ShieldCheck size={16} /> },
];

export function RightPanel({ width: initialWidth }: RightPanelProps) {
    const { activeRightTab, setActiveRightTab, setRightPanelWidth, toggleRightPanel } = useUIStore();

    const { width, isResizing, handleMouseDown } = useResizable({
        initialWidth,
        minWidth: 280,
        maxWidth: 500,
        direction: 'left',
        onResize: setRightPanelWidth,
    });

    const renderTabContent = () => {
        switch (activeRightTab) {
            case 'agents':
                return <AgentsPanel />;
            case 'context':
                return <ContextPanel />;
            case 'tasks':
                return <TasksPanel />;
            case 'files':
                return <FilesPanel />;
            case 'approvals':
                return <ApprovalsPanel />;
            default:
                return null;
        }
    };

    return (
        <aside className={styles.panel} style={{ width }}>
            {/* Resize Handle */}
            <div
                className={`${styles.resizeHandle} ${isResizing ? styles.resizing : ''}`}
                onMouseDown={handleMouseDown}
            />

            <div className={styles.content}>
                {/* Header with tabs */}
                <div className={styles.header}>
                    <div className={styles.tabs}>
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                className={`${styles.tab} ${activeRightTab === tab.id ? styles.activeTab : ''
                                    }`}
                                onClick={() => setActiveRightTab(tab.id)}
                                title={tab.label}
                            >
                                {tab.icon}
                            </button>
                        ))}
                    </div>
                    <button
                        className={styles.collapseButton}
                        onClick={toggleRightPanel}
                        aria-label="Collapse panel"
                    >
                        <PanelRightClose size={18} />
                    </button>
                </div>

                {/* Tab Content */}
                <div className={styles.tabContent}>
                    {renderTabContent()}
                </div>
            </div>
        </aside>
    );
}
