'use client';

import {
  ClockCounterClockwiseIcon,
  ImagesIcon,
  MagnifyingGlassIcon,
  UploadIcon,
} from '@phosphor-icons/react';

type StatCardProps = {
  icon: React.ElementType;
  label: string;
  value: string | number;
  href: string;
};

function StatCard({ icon: Icon, label, value, href }: StatCardProps) {
  return (
    <a
      href={href}
      className="block p-6 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
    >
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-lg bg-primary/10">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
      </div>
    </a>
  );
}

export function AdminDashboard() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Manage logo generation, vector search, and SVG ingestion.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={ClockCounterClockwiseIcon}
          label="Generation Histories"
          value="-"
          href="/admin/histories"
        />
        <StatCard
          icon={MagnifyingGlassIcon}
          label="Vector Search"
          value="Query"
          href="/admin/search"
        />
        <StatCard
          icon={ImagesIcon}
          label="Indexed Logos"
          value="-"
          href="/admin/logos"
        />
        <StatCard
          icon={UploadIcon}
          label="Upload SVGs"
          value="Ingest"
          href="/admin/upload"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-lg border border-border bg-card">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <a
              href="/admin/upload"
              className="flex items-center gap-3 p-3 rounded-md hover:bg-accent/50 transition-colors"
            >
              <UploadIcon className="w-5 h-5 text-muted-foreground" />
              <span>Upload new SVGs for indexing</span>
            </a>
            <a
              href="/admin/search"
              className="flex items-center gap-3 p-3 rounded-md hover:bg-accent/50 transition-colors"
            >
              <MagnifyingGlassIcon className="w-5 h-5 text-muted-foreground" />
              <span>Search the vector index</span>
            </a>
            <a
              href="/admin/histories"
              className="flex items-center gap-3 p-3 rounded-md hover:bg-accent/50 transition-colors"
            >
              <ClockCounterClockwiseIcon className="w-5 h-5 text-muted-foreground" />
              <span>View generation histories</span>
            </a>
          </div>
        </div>

        <div className="p-6 rounded-lg border border-border bg-card">
          <h2 className="text-lg font-semibold mb-4">Admin Info</h2>
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-muted-foreground">Admin Role</p>
              <p className="font-medium">Enabled via better-auth</p>
            </div>
            <div>
              <p className="text-muted-foreground">Access Method</p>
              <p className="font-medium">Email-based (casey.collins@hey.com, @logoer.com)</p>
            </div>
            <div>
              <p className="text-muted-foreground">Container</p>
              <p className="font-medium">Python FastAPI (RAG + Ingestion)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
