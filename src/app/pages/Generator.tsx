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
        <GeneratorClient />
      </div>
    </div>
  );
}
