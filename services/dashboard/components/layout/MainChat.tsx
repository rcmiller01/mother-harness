/**
 * Main Chat Component
 * Central message stream and input area
 */

'use client';

import React, { useRef, useEffect } from 'react';
import {
    Paperclip,
    Image,
    Code,
    AtSign,
    Send,
    ChevronDown,
    Loader2,
} from 'lucide-react';
import { useThreadStore } from '../../stores/threadStore';
import { UserMessage } from '../messages/UserMessage';
import { AssistantMessage } from '../messages/AssistantMessage';
import styles from './MainChat.module.css';

export function MainChat() {
    const {
        messages,
        isStreaming,
        inputValue,
        setInputValue,
        sendMessage,
    } = useThreadStore();

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-scroll on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            const newHeight = Math.min(
                Math.max(textareaRef.current.scrollHeight, 80),
                400
            );
            textareaRef.current.style.height = `${newHeight}px`;
        }
    }, [inputValue]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputValue.trim() && !isStreaming) {
            sendMessage(inputValue);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    return (
        <main className={styles.main}>
            {/* Messages Area */}
            <div className={styles.messages}>
                {messages.length === 0 ? (
                    <div className={styles.empty}>
                        <div className={styles.emptyIcon}>💬</div>
                        <h2 className={styles.emptyTitle}>Start a conversation</h2>
                        <p className={styles.emptyText}>
                            Ask me anything. I'll coordinate with specialized agents
                            to help you with research, coding, analysis, and more.
                        </p>
                    </div>
                ) : (
                    <div className={styles.messageList}>
                        {messages.map((message) =>
                            message.role === 'user' ? (
                                <UserMessage key={message.id} message={message} />
                            ) : (
                                <AssistantMessage key={message.id} message={message} />
                            )
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className={styles.inputArea}>
                <form onSubmit={handleSubmit} className={styles.inputForm}>
                    {/* Toolbar */}
                    <div className={styles.toolbar}>
                        <button
                            type="button"
                            className={styles.toolbarButton}
                            title="Attach file"
                        >
                            <Paperclip size={18} />
                        </button>
                        <button
                            type="button"
                            className={styles.toolbarButton}
                            title="Add image"
                        >
                            <Image size={18} />
                        </button>
                        <button
                            type="button"
                            className={styles.toolbarButton}
                            title="Insert code"
                        >
                            <Code size={18} />
                        </button>
                        <button
                            type="button"
                            className={styles.toolbarButton}
                            title="Mention agent"
                        >
                            <AtSign size={18} />
                        </button>

                        <div className={styles.toolbarSpacer} />

                        {/* Model Selector */}
                        <button type="button" className={styles.modelSelector}>
                            <span className={styles.modelDot} />
                            <span>gpt-oss:20b</span>
                            <ChevronDown size={14} />
                        </button>
                    </div>

                    {/* Input Box */}
                    <div className={styles.inputBox}>
                        <textarea
                            ref={textareaRef}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Message Mother-Harness..."
                            className={styles.textarea}
                            rows={1}
                            disabled={isStreaming}
                        />
                        <button
                            type="submit"
                            className={styles.sendButton}
                            disabled={!inputValue.trim() || isStreaming}
                        >
                            {isStreaming ? (
                                <Loader2 size={20} className={styles.spinner} />
                            ) : (
                                <Send size={20} />
                            )}
                        </button>
                    </div>

                    {/* Footer */}
                    <div className={styles.footer}>
                        <span className={styles.charCount}>
                            {inputValue.length} characters
                        </span>
                        <span className={styles.footerHint}>
                            Press Enter to send, Shift+Enter for new line
                        </span>
                    </div>
                </form>
            </div>
        </main>
    );
}
