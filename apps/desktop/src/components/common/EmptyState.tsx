export function EmptyState({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <div className="empty-state-text">{text}</div>
    </div>
  );
}
