import { requestInfo } from 'rwsdk/worker';

import { Card } from '@/components/ui/card';

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
          <p className="text-muted-foreground mt-1">
            Describe your logo and let AI create it for you
          </p>
        </div>

        {/* Three-panel layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-12rem)]">
          {/* Left Panel - Configuration */}
          <div className="lg:col-span-3">
            <Card className="h-full p-4 overflow-y-auto">
              <h2 className="font-semibold mb-4">Configuration</h2>

              {/* Logo Type */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Logo Type
                  </label>
                  <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="wordmark">Wordmark</option>
                    <option value="lettermark">Lettermark</option>
                    <option value="abstract">Abstract</option>
                    <option value="pictorial">Pictorial</option>
                    <option value="mascot">Mascot</option>
                    <option value="combination">Combination</option>
                    <option value="emblem">Emblem</option>
                  </select>
                </div>

                {/* Theme */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Theme
                  </label>
                  <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="modern">Modern</option>
                    <option value="minimal">Minimal</option>
                    <option value="bold">Bold</option>
                    <option value="elegant">Elegant</option>
                    <option value="playful">Playful</option>
                    <option value="tech">Tech</option>
                    <option value="vintage">Vintage</option>
                    <option value="organic">Organic</option>
                  </select>
                </div>

                {/* Shape */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Shape
                  </label>
                  <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="circle">Circle</option>
                    <option value="hexagon">Hexagon</option>
                    <option value="triangle">Triangle</option>
                    <option value="diamond">Diamond</option>
                    <option value="star">Star</option>
                    <option value="shield">Shield</option>
                  </select>
                </div>

                {/* Brand Text */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Brand Name
                  </label>
                  <input
                    type="text"
                    placeholder="ACME"
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>

                {/* Colors */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Primary Color
                  </label>
                  <div className="mt-1 flex gap-2">
                    <input
                      type="color"
                      defaultValue="#0f172a"
                      className="h-9 w-12 rounded border border-input"
                    />
                    <input
                      type="text"
                      defaultValue="#0f172a"
                      className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Accent Color
                  </label>
                  <div className="mt-1 flex gap-2">
                    <input
                      type="color"
                      defaultValue="#3b82f6"
                      className="h-9 w-12 rounded border border-input"
                    />
                    <input
                      type="text"
                      defaultValue="#3b82f6"
                      className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Center Panel - Preview Canvas */}
          <div className="lg:col-span-6">
            <Card className="h-full p-4 flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold">Preview</h2>
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 text-sm rounded-md border border-input hover:bg-accent">
                    Export SVG
                  </button>
                  <button className="px-3 py-1.5 text-sm rounded-md border border-input hover:bg-accent">
                    Export PNG
                  </button>
                </div>
              </div>

              {/* Preview Area */}
              <div className="flex-1 bg-muted/30 rounded-lg flex items-center justify-center border-2 border-dashed border-border">
                <div className="text-center text-muted-foreground">
                  <svg
                    className="mx-auto h-12 w-12 mb-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <p className="font-medium">No logo generated yet</p>
                  <p className="text-sm mt-1">
                    Describe your logo in the chat to get started
                  </p>
                </div>
              </div>

              {/* Zoom controls */}
              <div className="flex justify-center gap-2 mt-4">
                <button className="px-3 py-1 text-sm rounded-md border border-input hover:bg-accent">
                  -
                </button>
                <span className="px-3 py-1 text-sm">100%</span>
                <button className="px-3 py-1 text-sm rounded-md border border-input hover:bg-accent">
                  +
                </button>
              </div>
            </Card>
          </div>

          {/* Right Panel - Chat */}
          <div className="lg:col-span-3">
            <Card className="h-full p-4 flex flex-col">
              <h2 className="font-semibold mb-4">Chat</h2>

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                <div className="bg-muted/50 rounded-lg p-3 text-sm">
                  <p className="font-medium text-muted-foreground mb-1">
                    Logo Agent
                  </p>
                  <p>
                    Hi! I&apos;m your logo design assistant. Describe the logo
                    you want to create, and I&apos;ll help bring it to life.
                  </p>
                </div>
              </div>

              {/* Input area */}
              <div className="border-t pt-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Describe your logo..."
                    className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90">
                    Send
                  </button>
                </div>
                <div className="flex gap-2 mt-2 flex-wrap">
                  <button className="px-2 py-1 text-xs rounded border border-input hover:bg-accent">
                    Make it minimal
                  </button>
                  <button className="px-2 py-1 text-xs rounded border border-input hover:bg-accent">
                    Bolder colors
                  </button>
                  <button className="px-2 py-1 text-xs rounded border border-input hover:bg-accent">
                    Add more detail
                  </button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
