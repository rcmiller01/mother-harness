export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <head>
                <title>Mother-Harness</title>
                <meta name="description" content="Multi-agent orchestration dashboard" />
            </head>
            <body>{children}</body>
        </html>
    );
}
