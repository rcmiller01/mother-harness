/**
 * Header Component
 * Top navigation bar with logo, search, and user controls
 */

'use client';

import React from 'react';
import {
    Search,
    Bell,
    Settings,
    Moon,
    Sun,
    User,
    ChevronDown,
    Zap,
} from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useShortcutHint } from '../../hooks/useKeyboardShortcuts';
import styles from './Header.module.css';

export function Header() {
    const { theme, setTheme, openCommandPalette } = useUIStore();
    const cmdKHint = useShortcutHint('K', true);

    return (
        <header className={styles.header}>
            {/* Left section - Logo and project selector */}
            <div className={styles.left}>
                <div className={styles.logo}>
                    <Zap className={styles.logoIcon} size={24} />
                    <span className={styles.logoText}>Mother-Harness</span>
                </div>

                <div className={styles.projectSelector}>
                    <span className={styles.projectName}>Authentication System</span>
                    <ChevronDown size={16} />
                </div>
            </div>

            {/* Center section - Command palette trigger */}
            <div className={styles.center}>
                <button
                    className={styles.searchButton}
                    onClick={openCommandPalette}
                    aria-label="Open command palette"
                >
                    <Search size={16} />
                    <span>Search or run commands...</span>
                    <kbd className={styles.kbd}>{cmdKHint}</kbd>
                </button>
            </div>

            {/* Right section - Actions and user */}
            <div className={styles.right}>
                <button
                    className={styles.iconButton}
                    aria-label="Notifications"
                >
                    <Bell size={20} />
                    <span className={styles.notificationBadge}>3</span>
                </button>

                <button
                    className={styles.iconButton}
                    aria-label="Settings"
                >
                    <Settings size={20} />
                </button>

                <button
                    className={styles.iconButton}
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    aria-label="Toggle theme"
                >
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>

                <div className={styles.divider} />

                <button className={styles.userButton}>
                    <div className={styles.avatar}>
                        <User size={18} />
                    </div>
                    <ChevronDown size={14} />
                </button>
            </div>
        </header>
    );
}
