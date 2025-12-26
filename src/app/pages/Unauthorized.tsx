import { ShieldWarningIcon } from '@phosphor-icons/react/dist/ssr';

export function Unauthorized() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-md px-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 mb-6">
          <ShieldWarningIcon className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground mb-2">
          Access Denied
        </h1>
        <p className="text-muted-foreground mb-6">
          You don't have permission to access this page. Admin access is required.
        </p>
        <a
          href="/"
          className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 transition-colors"
        >
          Return Home
        </a>
      </div>
    </div>
  );
}
