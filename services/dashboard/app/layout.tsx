'use client';

import './globals.css';
import React from 'react';
import { IdentityProvider } from '../components/identity/IdentityProvider';
import { EventStreamProvider } from '../components/providers/EventStreamProvider';
import { ErrorBoundary } from '../components/providers/ErrorBoundary';

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <head>
                <title>Mother-Harness | Mission Control</title>
                <meta name="description" content="Multi-agent orchestration dashboard" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
                    rel="stylesheet"
                />
            </head>
            <body>
                <ErrorBoundary>
                    <IdentityProvider>
                        <EventStreamProvider>
                            {children}
                        </EventStreamProvider>
                    </IdentityProvider>
                </ErrorBoundary>
            </body>
        </html>
    );
}


