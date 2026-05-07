export function CodeBlock({
  children,
  maxHeight,
}: {
  children: string;
  maxHeight?: number;
}) {
  return (
    <pre className="code-block" style={maxHeight ? { maxHeight } : undefined}>
      {children}
    </pre>
  );
}
