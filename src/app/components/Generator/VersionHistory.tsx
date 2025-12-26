'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash, Check } from '@phosphor-icons/react';

export interface LogoVersion {
  id: string;
  svg: string;
  timestamp: Date;
}

interface VersionHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: LogoVersion[];
  currentSvg: string | null;
  onSelectVersion: (id: string) => void;
  onDeleteVersion?: (id: string) => void;
}

export function VersionHistory({
  open,
  onOpenChange,
  versions,
  currentSvg,
  onSelectVersion,
  onDeleteVersion,
}: VersionHistoryProps) {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    if (isToday) return 'Today';

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();
    if (isYesterday) return 'Yesterday';

    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Group versions by date
  const groupedVersions = versions.reduce(
    (groups, version) => {
      const dateKey = version.timestamp.toDateString();
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(version);
      return groups;
    },
    {} as Record<string, LogoVersion[]>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-80 p-0">
        <SheetHeader className="border-b p-4">
          <SheetTitle>Version History</SheetTitle>
          <SheetDescription>
            {versions.length} version{versions.length !== 1 ? 's' : ''} saved
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)]">
          <div className="space-y-4 p-4">
            {Object.entries(groupedVersions)
              .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
              .map(([dateKey, dateVersions]) => (
                <div key={dateKey}>
                  <h3 className="mb-2 text-xs font-medium text-muted-foreground">
                    {formatDate(new Date(dateKey))}
                  </h3>
                  <div className="space-y-2">
                    {dateVersions
                      .sort(
                        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
                      )
                      .map((version, index) => {
                        const isActive = currentSvg === version.svg;
                        return (
                          <div
                            key={version.id}
                            className={`group relative rounded-lg border p-2 transition-colors ${
                              isActive
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/50'
                            }`}
                          >
                            <button
                              onClick={() => onSelectVersion(version.id)}
                              className="flex w-full items-start gap-3"
                            >
                              {/* Thumbnail */}
                              <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded border bg-white">
                                <div
                                  className="flex h-full w-full items-center justify-center p-1 [&>svg]:h-full [&>svg]:w-full"
                                  dangerouslySetInnerHTML={{ __html: version.svg }}
                                />
                              </div>

                              {/* Info */}
                              <div className="flex-1 text-left">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium">
                                    Version {dateVersions.length - index}
                                  </span>
                                  {isActive && (
                                    <Badge
                                      variant="default"
                                      className="h-4 gap-0.5 px-1 text-[10px]"
                                    >
                                      <Check className="h-2.5 w-2.5" />
                                      Current
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-[10px] text-muted-foreground">
                                  {formatTime(version.timestamp)}
                                </span>
                              </div>
                            </button>

                            {/* Delete button */}
                            {onDeleteVersion && !isActive && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="absolute right-1 top-1 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteVersion(version.id);
                                }}
                              >
                                <Trash className="h-3 w-3 text-muted-foreground" />
                              </Button>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}

            {versions.length === 0 && (
              <div className="py-8 text-center text-muted-foreground">
                <p className="text-sm">No versions yet</p>
                <p className="mt-1 text-xs">
                  Generate a logo to start saving versions
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
