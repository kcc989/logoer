import { requestInfo } from 'rwsdk/worker';

import { GeneratorClient } from '@/app/components/Generator';

export async function Generator() {
  const { ctx } = requestInfo;

  if (!ctx.user) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-6 py-12">
          <p>Please log in to use the logo generator</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Logo Generator
          </h1>
          <p className="mt-1 text-muted-foreground">
            Describe your logo and let AI create it for you
          </p>
        </div>

        {/* Interactive Generator */}
        <GeneratorClient />
      </div>
    </div>
  );
}
