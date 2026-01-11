export default function InvitationLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div
            style={{
                minHeight: '90vh',
                backgroundColor: '#ffffff00',
                color: '#111111',
            }}
        >
            {children}
        </div>
    );
}
