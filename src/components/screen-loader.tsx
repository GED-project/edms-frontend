export function ScreenLoader() {
  return (
    <div className="flex flex-col items-center gap-2 justify-center fixed inset-0 z-50">
      <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center animate-pulse" />
      <div className="text-muted-foreground font-medium text-sm">
        Chargement…
      </div>
    </div>
  );
}
