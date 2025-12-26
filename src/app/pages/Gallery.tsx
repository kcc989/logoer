import { requestInfo } from 'rwsdk/worker';

import { GalleryClient } from '@/app/components/Gallery';

export async function Gallery() {
  const { ctx } = requestInfo;

  if (!ctx.user) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-6 py-12">
          <p>Please log in to view your gallery</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Logo Gallery
            </h1>
            <p className="mt-1 text-muted-foreground">
              Your saved logos and designs
            </p>
          </div>
          <a
            href="/generator"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Create New Logo
          </a>
        </div>

        {/* Gallery Grid */}
        <GalleryClient />
      </div>
    </div>
  );
}
