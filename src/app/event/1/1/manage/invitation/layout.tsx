export default function InvitationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f5f7fa',
        color:'#111111'
      }}
    >
      {children}
    </div>
  );
}
